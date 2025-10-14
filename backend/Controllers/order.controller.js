// controllers/orderController.js
import mongoose from "mongoose";
import Order from "../Models/Order.js";
import Cart from "../Models/Cart.js";
import Product from "../Models/Product.js";
import ProductVariant from "../Models/ProductVariant.js";
import Coupon from "../Models/Coupon.js";
import Payment from "../Models/Payments.js";
import PaymentSession from "../Models/PaymentSession.js";
import PaymentGatewayConfig from "../Models/PaymentGatewayConfig.js";
import User from "../Models/User.js";
import WalletTransaction from "../Models/WalletTransaction.js";
import { getActiveGatewayAdapter } from "../Services/gatewayFactory.js";
import logger from "../utils/logger.js";

/**
 * Enhanced Stock Reservation Model with TTL
 */
const StockReservationSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    items: [
      {
        variant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ProductVariant",
          required: true,
        },
        qty: { type: Number, required: true },
        price: { type: Number, required: true },
      },
    ],
    status: {
      type: String,
      enum: ["active", "consumed", "released", "expired"],
      default: "active",
    },
    reservedUntil: { type: Date, required: true, index: true },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

// TTL index for automatic cleanup
StockReservationSchema.index({ reservedUntil: 1 }, { expireAfterSeconds: 0 });
const StockReservation =
  mongoose.models.StockReservation ||
  mongoose.model("StockReservation", StockReservationSchema);

/**
 * CouponUsage Model for atomic usage tracking
 */
const CouponUsageSchema = new mongoose.Schema(
  {
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    uses: { type: Number, default: 0 },
  },
  { timestamps: true }
);
CouponUsageSchema.index({ coupon: 1, user: 1 }, { unique: true });
const CouponUsage =
  mongoose.models.CouponUsage ||
  mongoose.model("CouponUsage", CouponUsageSchema);

// ========== UTILITY FUNCTIONS ==========

function validateStateTransition(currentState, newState, stateMachine) {
  const allowedTransitions = stateMachine[currentState] || [];
  if (!allowedTransitions.includes(newState)) {
    throw new Error(`Invalid state transition: ${currentState} -> ${newState}`);
  }
}

function generateIdempotencyKey() {
  return `idemp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function validateUserOwnership(
  resource,
  userId,
  resourceType = "resource"
) {
  if (String(resource.user) !== String(userId)) {
    throw new Error(`Unauthorized access to ${resourceType}`);
  }
}

/**
 * Atomic stock operations with optimistic locking
 */
async function decrementVariantStockAtomic(variantId, qty, session) {
  const variant = await ProductVariant.findById(variantId).session(session);
  if (!variant) throw new Error(`Variant not found: ${variantId}`);
  if (variant.stock < qty) {
    throw new Error(
      `Insufficient stock for variant ${variantId}. Available: ${variant.stock}, Requested: ${qty}`
    );
  }

  const res = await ProductVariant.updateOne(
    {
      _id: variantId,
      stock: { $gte: qty },
      __v: variant.__v,
    },
    {
      $inc: { stock: -qty, __v: 1 },
    },
    { session }
  );

  if (res.modifiedCount === 0) {
    throw new Error(
      `Stock update failed for variant ${variantId}. Possible race condition.`
    );
  }
}

async function incrementVariantStock(variantId, qty, session) {
  await ProductVariant.updateOne(
    { _id: variantId },
    { $inc: { stock: qty } },
    { session }
  );
}

/**
 * Enhanced price validation with server-side recalculation
 */
async function validateAndRecalculatePrices(items, session) {
  let serverSubtotal = 0;
  const validatedItems = [];

  for (const it of items) {
    const variant = await ProductVariant.findById(it.variant)
      .populate("product")
      .session(session);

    if (!variant) throw new Error(`Variant not found: ${it.variant}`);
    if (!variant.product)
      throw new Error(`Product not found for variant: ${it.variant}`);

    // Use server-side price only for security
    const serverPrice = variant.price;
    const lineTotal = serverPrice * it.quantity;

    validatedItems.push({
      product: variant.product._id,
      variant: variant._id,
      title: variant.product.title,
      color: it.color,
      size: it.size,
      price: serverPrice,
      quantity: it.quantity,
      lineTotal: lineTotal,
    });

    serverSubtotal += lineTotal;
  }

  return { validatedItems, serverSubtotal };
}

/**
 * Coupon validation and reservation
 */
async function computeApplicableSubtotalForCoupon(coupon, items, session) {
  const productIdsFilter = (coupon.applicableProductIds || []).map(String);
  const categoryIdsFilter = (coupon.applicableCategoryIds || []).map(String);

  if (productIdsFilter.length === 0 && categoryIdsFilter.length === 0) {
    return items.reduce((s, it) => s + it.lineTotal, 0);
  }

  const uniqueProductIds = [...new Set(items.map((it) => String(it.product)))];
  const products = await Product.find({ _id: { $in: uniqueProductIds } })
    .select("_id category categories primaryCategoryId")
    .session(session);

  const productToCategories = new Map();
  for (const p of products) {
    let cats = [];
    if (Array.isArray(p.categories)) cats = p.categories.map(String);
    else if (Array.isArray(p.category)) cats = p.category.map(String);
    else if (p.category) cats = [String(p.category)];
    else if (p.primaryCategoryId) cats = [String(p.primaryCategoryId)];
    productToCategories.set(String(p._id), cats);
  }

  const productSet = new Set(productIdsFilter);
  const categorySet = new Set(categoryIdsFilter);

  let applicableSubtotal = 0;
  for (const it of items) {
    const pid = String(it.product);
    let included = false;
    if (productSet.size > 0 && productSet.has(pid)) included = true;
    if (!included && categorySet.size > 0) {
      const cats = productToCategories.get(pid) || [];
      for (const c of cats) {
        if (categorySet.has(String(c))) {
          included = true;
          break;
        }
      }
    }
    if (included) applicableSubtotal += it.lineTotal;
  }
  return applicableSubtotal;
}

async function reserveCouponUsageAtomic(
  couponCode,
  userId,
  subtotal,
  applicableSubtotal,
  session
) {
  const code = String(couponCode || "").toUpperCase();
  const coupon = await Coupon.findOne({ code }).session(session);
  if (!coupon || !coupon.active) throw new Error("Invalid or inactive coupon");

  // Target user validation
  if (coupon.targetUser && String(coupon.targetUser) !== String(userId)) {
    throw new Error("Coupon is valid for specific user only");
  }

  // Expiry check
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    throw new Error("Coupon has expired");
  }

  // Minimum order value
  if ((coupon.minOrderValue || 0) > 0 && subtotal < coupon.minOrderValue) {
    throw new Error(`Minimum order value of ${coupon.minOrderValue} required`);
  }

  if ((applicableSubtotal || 0) <= 0) {
    throw new Error("Coupon not applicable to order items");
  }

  let usageRecord = null;

  // Per-user usage limit
  if (coupon.maxUsesPerUser && coupon.maxUsesPerUser > 0) {
    usageRecord = await CouponUsage.findOneAndUpdate(
      {
        coupon: coupon._id,
        user: userId,
        $or: [
          { uses: { $exists: false } },
          { uses: { $lt: coupon.maxUsesPerUser } },
        ],
      },
      { $inc: { uses: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true, session }
    );
    if (!usageRecord) throw new Error("Coupon usage limit reached for user");
  }

  // Global usage limit
  if (coupon.maxUses && coupon.maxUses > 0) {
    const updatedCoupon = await Coupon.findOneAndUpdate(
      {
        _id: coupon._id,
        $or: [
          { maxUses: { $exists: false } },
          { usesCount: { $lt: coupon.maxUses } },
        ],
      },
      { $inc: { usesCount: 1 } },
      { session, new: true }
    );
    if (!updatedCoupon) {
      // Revert per-user usage if global limit fails
      if (usageRecord) {
        await CouponUsage.updateOne(
          { _id: usageRecord._id },
          { $inc: { uses: -1 } }
        ).session(session);
      }
      throw new Error("Coupon usage limit reached");
    }
    coupon.usesCount = updatedCoupon.usesCount;
  } else {
    coupon.usesCount = (coupon.usesCount || 0) + 1;
    await coupon.save({ session });
  }

  return { coupon, usageRecord };
}

async function revertCouponReservation(couponId, usageRecordId, session) {
  if (usageRecordId) {
    await CouponUsage.updateOne(
      { _id: usageRecordId, uses: { $gt: 0 } },
      { $inc: { uses: -1 } },
      { session }
    );
  }
  if (couponId) {
    await Coupon.updateOne(
      { _id: couponId, usesCount: { $gt: 0 } },
      { $inc: { usesCount: -1 } }
    ).session(session);
  }
}

/**
 * Wallet Operations
 */
async function processWalletPayment(userId, amount, orderId, session) {
  const user = await User.findById(userId).session(session);
  const walletAvailable = Number(user.wallet?.balance || 0);

  if (walletAvailable <= 0) {
    throw new Error("Wallet balance is zero");
  }

  if (amount <= 0) {
    throw new Error("Invalid wallet payment amount");
  }

  // Double-check we're not trying to deduct more than available
  const actualDeductAmount = Math.min(amount, walletAvailable);

  // Create wallet transaction
  const walletTx = await WalletTransaction.create(
    [
      {
        user: userId,
        type: "debit",
        amount: actualDeductAmount,
        currency: "INR",
        status: "available",
        source: "order",
        refId: orderId,
        meta: {
          note: "Wallet debit for order payment",
          originalRequested: amount,
          actualProcessed: actualDeductAmount,
        },
      },
    ],
    { session }
  );

  // Update user balance
  user.wallet.balance = walletAvailable - actualDeductAmount;
  await user.save({ session });

  logger.info("Wallet payment processed successfully", {
    userId,
    requested: amount,
    processed: actualDeductAmount,
    remainingBalance: user.wallet.balance,
  });

  return walletTx[0];
}

async function processWalletRefund(userId, amount, orderId, reason, session) {
  const user = await User.findById(userId).session(session);

  // Create credit transaction
  const walletTx = await WalletTransaction.create(
    [
      {
        user: userId,
        type: "credit",
        amount: amount,
        currency: "INR",
        status: "available",
        source: "refund",
        refId: orderId,
        meta: { reason },
      },
    ],
    { session }
  );

  // Update user balance
  user.wallet.balance = (user.wallet.balance || 0) + amount;
  await user.save({ session });

  return walletTx[0];
}

/**
 * Stock Reservation Management
 */
async function createStockReservation(orderId, items, paymentId, session) {
  const reserveMinutes = Number(process.env.RESERVATION_TTL_MINUTES || 10);
  const reservedUntil = new Date(Date.now() + reserveMinutes * 60 * 1000);

  const reservationItems = items.map((it) => ({
    variant: it.variant,
    qty: it.quantity,
    price: it.price,
  }));

  const reservation = new StockReservation({
    order: orderId,
    payment: paymentId,
    items: reservationItems,
    status: "active",
    reservedUntil,
    meta: { createdAt: new Date() },
  });

  await reservation.save({ session });
  return reservation;
}

async function consumeStockReservation(orderId, paymentId, session) {
  const reservation = await StockReservation.findOne({
    order: orderId,
    payment: paymentId,
    status: "active",
  }).session(session);

  if (reservation) {
    reservation.status = "consumed";
    await reservation.save({ session });
  }
  return reservation;
}

async function releaseStockReservation(orderId, paymentId, session) {
  const reservation = await StockReservation.findOne({
    $or: [
      { order: orderId, payment: paymentId },
      { order: orderId, payment: null },
    ],
    status: "active",
  }).session(session);

  if (reservation) {
    // Return stock to inventory
    for (const it of reservation.items) {
      await incrementVariantStock(it.variant, it.qty, session);
    }
    reservation.status = "released";
    await reservation.save({ session });
  }
  return reservation;
}

// ========== PAYMENT SERVICE CLASS ==========

class PaymentService {
  /**
   * Create payment session and process payment
   */
  async createPaymentSession(userId, orderId, sessionData) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // 1. Validate order and user
      const [order, user] = await Promise.all([
        Order.findById(orderId).session(session),
        User.findById(userId).session(session),
      ]);

      if (!order || order.status !== "pending") {
        throw new Error("Order not available for payment");
      }

      if (order.user.toString() !== userId) {
        throw new Error("Unauthorized access to order");
      }

      // 2. Validate wallet balance (read-only - NO DEDUCTION)
      if (sessionData.walletAmount > 0) {
        if (user.wallet.balance < sessionData.walletAmount) {
          throw new Error("Insufficient wallet balance");
        }
        if (sessionData.walletAmount > order.total) {
          throw new Error("Wallet amount exceeds order total");
        }
      }

      const gatewayAmount = order.total - sessionData.walletAmount;

      // 3. Reserve stock atomically
      for (const item of order.items) {
        await decrementVariantStockAtomic(item.variant, item.quantity, session);
      }

      // 4. Create stock reservation
      const stockReservation = await createStockReservation(
        order._id,
        order.items,
        null,
        session
      );

      // 5. Reserve coupon usage atomically
      let couponReservedMeta = { couponId: null, usageRecordId: null };
      let discountAmount = order.discountAmount || 0;

      if (order.coupon?.couponId) {
        const couponDoc = await Coupon.findById(order.coupon.couponId).session(
          session
        );
        if (!couponDoc || !couponDoc.active) {
          throw new Error("Coupon invalid or expired");
        }

        const applicableSubtotal = await computeApplicableSubtotalForCoupon(
          couponDoc,
          order.items,
          session
        );

        const reserved = await reserveCouponUsageAtomic(
          couponDoc.code,
          userId,
          order.subtotal,
          applicableSubtotal,
          session
        );

        couponReservedMeta.couponId = reserved.coupon._id;
        couponReservedMeta.usageRecordId = reserved.usageRecord?._id || null;

        // Recalculate discount
        if (reserved.coupon.type === "fixed") {
          discountAmount = Math.min(reserved.coupon.value, applicableSubtotal);
        } else if (reserved.coupon.type === "percentage") {
          discountAmount = (applicableSubtotal * reserved.coupon.value) / 100;
          if (reserved.coupon.maxDiscountAmount) {
            discountAmount = Math.min(
              discountAmount,
              reserved.coupon.maxDiscountAmount
            );
          }
        }
      }

      // ✅ FIX 1 & 2: Update order with final discount amounts and store couponId
      order.discountAmount = discountAmount;
      order.total = order.subtotal - discountAmount;
      order.paymentMethod = sessionData.paymentMethod;
      await order.save({ session });

      // 6. Create or update payment session (ATOMIC)
      const paymentSession = await PaymentSession.findOneAndUpdate(
        { order: orderId, status: "active" },
        {
          $setOnInsert: {
            sessionId: sessionData.sessionId,
            user: userId,
            order: orderId,
            walletAmount: sessionData.walletAmount,
            paymentMethod: sessionData.paymentMethod,
            status: "active",
            createdAt: new Date(),
            meta: {
              userAgent: sessionData.userAgent,
              ip: sessionData.ip,
              couponUsageRecordId: couponReservedMeta.usageRecordId,
              couponId: couponReservedMeta.couponId, // ✅ FIX 1: Store couponId
            },
          },
        },
        {
          upsert: true,
          new: true,
          session: session,
        }
      );

      let gatewayPayload = null;

      // 7. Handle different payment methods
      if (sessionData.paymentMethod === "cod") {
        // COD - immediately confirm order and deduct wallet
        await this.processCODPayment(
          order,
          user,
          paymentSession,
          stockReservation,
          session
        );
      } else {
        // Online payment - create gateway order (wallet deducted later in webhook)
        const adapter = await getActiveGatewayAdapter();
        gatewayPayload = await adapter.createOrder({
          amount: gatewayAmount,
          currency: "INR",
          receipt: `order_${orderId}_${sessionData.sessionId}`,
          notes: {
            orderId: orderId.toString(),
            sessionId: sessionData.sessionId,
            userId: userId.toString(),
          },
        });

        paymentSession.gatewayOrderId = gatewayPayload.id;
        await paymentSession.save({ session });

        // Link stock reservation to payment session
        stockReservation.payment = paymentSession._id;
        await stockReservation.save({ session });
      }

      await session.commitTransaction();

      logger.info("Payment session created successfully", {
        sessionId: paymentSession.sessionId,
        orderId,
        paymentMethod: sessionData.paymentMethod,
        walletAmount: sessionData.walletAmount,
        gatewayAmount,
      });

      return {
        success: true,
        sessionId: paymentSession.sessionId,
        gateway: gatewayPayload,
        walletAmount: sessionData.walletAmount,
        gatewayAmount: gatewayAmount,
        paymentMethod: sessionData.paymentMethod,
        orderStatus:
          sessionData.paymentMethod === "cod" ? "confirmed" : "pending",
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error("Payment session creation failed", {
        orderId,
        userId,
        error: error.message,
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Process COD payment - deduct wallet immediately
   */
  async processCODPayment(
    order,
    user,
    paymentSession,
    stockReservation,
    dbSession
  ) {
    // 1. Deduct wallet amount if any
    if (paymentSession.walletAmount > 0) {
      user.wallet.balance -= paymentSession.walletAmount;
      await user.save({ session: dbSession });

      await WalletTransaction.create(
        [
          {
            user: user._id,
            type: "debit",
            amount: paymentSession.walletAmount,
            currency: "INR",
            status: "available",
            source: "order",
            refId: order._id,
            meta: { note: "Wallet payment for COD order" },
          },
        ],
        { session: dbSession }
      );
    }

    const codAmount = order.total - paymentSession.walletAmount;

    // 2. Create COD payment record
    const payment = new Payment({
      order: order._id,
      user: user._id,
      method: "cod",
      amount: codAmount,
      currency: "INR",
      status: "cod_pending",
      meta: { sessionId: paymentSession.sessionId },
    });
    await payment.save({ session: dbSession });

    // 3. Update order status
    order.status = "confirmed";
    order.paymentMethod = "cod";

    // Add payment snapshots
    if (paymentSession.walletAmount > 0) {
      order.payments.push({
        method: "wallet",
        amount: paymentSession.walletAmount,
        status: "success",
        meta: {},
      });
    }

    order.payments.push({
      method: "cod",
      amount: codAmount,
      status: "cod_pending",
      meta: {},
    });

    await order.save({ session: dbSession });

    // 4. Consume stock reservation
    stockReservation.status = "consumed";
    stockReservation.payment = payment._id;
    await stockReservation.save({ session: dbSession });

    // 5. Mark session completed
    paymentSession.status = "completed";
    paymentSession.completedAt = new Date();
    await paymentSession.save({ session: dbSession });

    // 6. Clear cart
    await Cart.updateOne(
      { user: user._id },
      { $set: { items: [], totalValue: 0 } },
      { session: dbSession }
    );

    logger.info("COD order processed successfully", {
      sessionId: paymentSession.sessionId,
      orderId: order._id,
      walletAmount: paymentSession.walletAmount,
      codAmount,
    });
  }

  /**
   * Process successful online payment (via webhook)
   */
  async processSuccessfulPayment(gatewayPaymentId, sessionId, gatewayData) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // 1. Find active payment session
      const paymentSession = await PaymentSession.findOne({
        sessionId: sessionId,
        status: "active",
      }).session(session);

      if (!paymentSession) {
        throw new Error("Payment session not found or already processed");
      }

      // 2. Verify payment with gateway
      const adapter = await getActiveGatewayAdapter();
      const verification = await adapter.verifyPayment(gatewayData);

      if (!verification.valid) {
        throw new Error("Payment verification failed");
      }

      const [order, user] = await Promise.all([
        Order.findById(paymentSession.order).session(session),
        User.findById(paymentSession.user).session(session),
      ]);

      // ✅ FIX 4: Ensure order pricing consistency in webhook
      // Recalculate and apply final pricing to maintain consistency
      if (paymentSession.meta.couponId) {
        const coupon = await Coupon.findById(
          paymentSession.meta.couponId
        ).session(session);
        if (coupon && coupon.active) {
          const applicableSubtotal = await computeApplicableSubtotalForCoupon(
            coupon,
            order.items,
            session
          );

          let finalDiscount = 0;
          if (coupon.type === "fixed") {
            finalDiscount = Math.min(coupon.value, applicableSubtotal);
          } else if (coupon.type === "percentage") {
            finalDiscount = (applicableSubtotal * coupon.value) / 100;
            if (coupon.maxDiscountAmount) {
              finalDiscount = Math.min(finalDiscount, coupon.maxDiscountAmount);
            }
          }

          order.discountAmount = finalDiscount;
          order.total = order.subtotal - finalDiscount;
        }
      }

      // 3. Process wallet payment if any (ONLY NOW - when payment is certain)
      if (paymentSession.walletAmount > 0) {
        // Final balance check (might have changed since session creation)
        if (user.wallet.balance < paymentSession.walletAmount) {
          throw new Error("Insufficient wallet balance at payment time");
        }

        user.wallet.balance -= paymentSession.walletAmount;
        await user.save({ session });

        await WalletTransaction.create(
          [
            {
              user: user._id,
              type: "debit",
              amount: paymentSession.walletAmount,
              currency: "INR",
              status: "available",
              source: "order",
              refId: order._id,
              meta: { note: "Wallet payment for online order" },
            },
          ],
          { session }
        );
      }

      // 4. Create gateway payment record
      const payment = new Payment({
        order: order._id,
        user: user._id,
        method: paymentSession.paymentMethod,
        amount: verification.amount,
        currency: "INR",
        gatewayPaymentId: gatewayPaymentId,
        status: "success",
        meta: {
          sessionId: sessionId,
          gatewayData: verification,
        },
      });
      await payment.save({ session });

      // 5. Update order
      order.status = "confirmed";
      order.paymentMethod = paymentSession.paymentMethod;

      // Add payment snapshots
      if (paymentSession.walletAmount > 0) {
        order.payments.push({
          method: "wallet",
          amount: paymentSession.walletAmount,
          status: "success",
          meta: {},
        });
      }

      order.payments.push({
        method: paymentSession.paymentMethod,
        amount: verification.amount,
        gatewayPaymentId: gatewayPaymentId,
        status: "success",
        meta: {},
      });

      await order.save({ session });

      // 6. Consume stock reservation
      const stockReservation = await StockReservation.findOne({
        order: order._id,
        status: "active",
      }).session(session);

      if (stockReservation) {
        stockReservation.status = "consumed";
        stockReservation.payment = payment._id;
        await stockReservation.save({ session });
      }

      // 7. Mark session completed
      paymentSession.status = "completed";
      paymentSession.completedAt = new Date();
      paymentSession.meta.gatewayResponse = verification;
      await paymentSession.save({ session });

      // 8. Clear cart
      await Cart.updateOne(
        { user: user._id },
        { $set: { items: [], totalValue: 0 } },
        { session }
      );

      await session.commitTransaction();

      logger.info("Online payment processed successfully", {
        sessionId,
        orderId: order._id,
        walletAmount: paymentSession.walletAmount,
        gatewayAmount: verification.amount,
      });

      return { success: true, orderId: order._id };
    } catch (error) {
      await session.abortTransaction();

      logger.error("Online payment processing failed", {
        sessionId,
        error: error.message,
      });

      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Handle payment failure
   */
  async handlePaymentFailure(sessionId, reason = "unknown") {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // 1. Find and mark session as failed
      const paymentSession = await PaymentSession.findOneAndUpdate(
        { sessionId: sessionId, status: "active" },
        {
          status: "failed",
          meta: { failureReason: reason },
        },
        { session, new: true }
      );

      if (!paymentSession) {
        await session.commitTransaction();
        return { success: false, message: "Session not found" };
      }

      // 2. Release stock reservation
      await releaseStockReservation(paymentSession.order, null, session);

      // ✅ FIX 3: Fix coupon revert in failure handling
      if (
        paymentSession.meta.couponUsageRecordId &&
        paymentSession.meta.couponId
      ) {
        await revertCouponReservation(
          paymentSession.meta.couponId, // ✅ Now we have couponId
          paymentSession.meta.couponUsageRecordId,
          session
        );
      }

      // 4. Update order status if needed
      const order = await Order.findById(paymentSession.order).session(session);
      if (order && order.status === "pending") {
        order.status = "failed";
        order.meta.paymentFailure = {
          sessionId,
          reason,
          timestamp: new Date(),
        };
        await order.save({ session });
      }

      await session.commitTransaction();

      logger.info("Payment failure handled", { sessionId, reason });

      return { success: true, sessionId };
    } catch (error) {
      await session.abortTransaction();
      logger.error("Payment failure handling failed", {
        sessionId,
        error: error.message,
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get payment session status
   */
  async getPaymentStatus(sessionId) {
    const paymentSession = await PaymentSession.findOne({ sessionId });

    if (!paymentSession) {
      return { status: "expired" };
    }

    return {
      status: paymentSession.status,
      sessionId: paymentSession.sessionId,
      orderId: paymentSession.order,
      paymentMethod: paymentSession.paymentMethod,
      walletAmount: paymentSession.walletAmount,
      completedAt: paymentSession.completedAt,
    };
  }
}

// Create payment service instance
const paymentService = new PaymentService();

// ========== CONTROLLER ACTIONS ==========

/**
 * Create Order
 */
export const createOrder = async (req, res) => {
  const idempotencyKey =
    req.header("Idempotency-Key") || generateIdempotencyKey();
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const {
      items: payloadItems = [],
      useCart = false,
      couponCode = null,
      shippingAddress = {},
      paymentMethod = "none",
      paymentInfo = {},
    } = req.body;
    const userId = req.user?._id || req.body.userId;

    if (!userId) {
      throw new Error("User ID required");
    }

    // Idempotency check
    if (idempotencyKey) {
      const existing = await Order.findOne({
        "meta.idempotencyKey": idempotencyKey,
        user: userId,
      }).session(session);
      if (existing) {
        await session.commitTransaction();
        session.endSession();
        return res.status(200).json(existing);
      }
    }

    // Gather and validate items
    let items = [];
    if (useCart) {
      const cart = await Cart.findOne({ user: userId }).session(session);
      if (!cart || !cart.items?.length) {
        throw new Error("Cart is empty");
      }
      items = cart.items;
    } else {
      if (!Array.isArray(payloadItems) || payloadItems.length === 0) {
        throw new Error("No items provided");
      }
      items = payloadItems;
    }

    // Validate prices and recalculate server-side
    const { validatedItems, serverSubtotal } =
      await validateAndRecalculatePrices(items, session);
    items = validatedItems;

    // Coupon validation (calculation only, no reservation)
    let discountAmount = 0;
    let couponRef = null;
    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
      }).session(session);

      if (!coupon || !coupon.active) {
        throw new Error("Invalid coupon");
      }

      const applicableSubtotal = await computeApplicableSubtotalForCoupon(
        coupon,
        items,
        session
      );

      if ((applicableSubtotal || 0) <= 0) {
        throw new Error("Coupon not applicable to order items");
      }

      // Calculate discount
      if (coupon.type === "fixed") {
        discountAmount = Math.min(coupon.value, applicableSubtotal);
      } else if (coupon.type === "percentage") {
        discountAmount = (applicableSubtotal * coupon.value) / 100;
        if (coupon.maxDiscountAmount) {
          discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
        }
      } else {
        throw new Error("Unsupported coupon type");
      }

      couponRef = coupon._id;
    }

    const total = Math.max(0, serverSubtotal - discountAmount);

    // Set TTL for pending orders
    const ttlHours = Number(process.env.PENDING_ORDER_TTL_HOURS || 48);
    const expireAt = new Date(Date.now() + ttlHours * 3600 * 1000);

    const order = new Order({
      user: userId,
      items,
      subtotal: serverSubtotal,
      discountAmount,
      total,
      coupon: couponRef
        ? {
            couponId: couponRef,
            code: couponCode.toUpperCase(),
            targetUser: couponRef.targetUser || null,
          }
        : { couponId: null, code: "" },
      status: "pending",
      paymentMethod: "none",
      paymentInfo,
      shippingAddress,
      meta: {
        idempotencyKey,
        createdAt: new Date(),
        source: useCart ? "cart" : "direct",
      },
      expireAt,
    });

    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    logger.info("Order created successfully", { orderId: order._id, userId });
    return res.status(201).json(order);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    logger.error("Order creation failed", {
      error: err.message,
      userId: req.user?._id,
      idempotencyKey,
    });

    return res.status(400).json({
      message: err.message || "Order creation failed",
    });
  }
};

/**
 * Create Payment Session
 */
export const createPaymentSession = async (req, res) => {
  try {
    const { orderId } = req.params;
    const {
      walletAmount = 0,
      paymentMethod,
      sessionId = generateSessionId(),
    } = req.body;

    const userId = req.user?._id || req.body.userId;

    if (!["cod", "razorpay", "payu"].includes(paymentMethod)) {
      return res.status(400).json({ message: "Unsupported payment method" });
    }

    logger.info("Creating payment session", {
      orderId,
      paymentMethod,
      walletAmount,
      sessionId,
      userId,
    });

    const result = await paymentService.createPaymentSession(userId, orderId, {
      sessionId,
      walletAmount,
      paymentMethod,
      userAgent: req.get("User-Agent"),
      ip: req.ip,
    });

    res.json(result);
  } catch (error) {
    logger.error("Payment session creation failed", {
      error: error.message,
      orderId: req.params.orderId,
      userId: req.user?._id,
    });

    res.status(400).json({
      message: error.message || "Payment session creation failed",
    });
  }
};

/**
 * Get Payment Status
 */
export const getPaymentStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const status = await paymentService.getPaymentStatus(sessionId);
    res.json(status);
  } catch (error) {
    logger.error("Get payment status failed", { error: error.message });
    res.status(400).json({ message: error.message });
  }
};

/**
 * Payment Webhook Handler
 */
export const paymentWebhook = async (req, res) => {
  const gateway = req.params.gateway;
  const payload = req.body;

  try {
    logger.info("Payment webhook received", { gateway, payload });

    const adapter = await getActiveGatewayAdapter();
    const verification = await adapter.verifyWebhook(payload);

    if (!verification.valid) {
      logger.warn("Invalid webhook signature", { gateway });
      return res.status(400).json({ error: "Invalid signature" });
    }

    const sessionId =
      payload.payload?.payment?.entity?.notes?.sessionId ||
      payload.notes?.sessionId;

    if (!sessionId) {
      logger.error("Session ID not found in webhook", { gateway });
      return res.status(400).json({ error: "Session ID not found" });
    }

    const event = payload.event || payload.status;

    if (event === "payment.captured" || event === "success") {
      await paymentService.processSuccessfulPayment(
        verification.gatewayPaymentId,
        sessionId,
        payload
      );
    } else if (event === "payment.failed" || event === "failed") {
      await paymentService.handlePaymentFailure(sessionId, "gateway_failure");
    }

    res.json({ received: true });
  } catch (error) {
    logger.error("Webhook processing failed", {
      gateway,
      error: error.message,
      payload,
    });

    res.status(500).json({ error: "Webhook processing failed" });
  }
};

/**
 * Get Order
 */
export const getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id)
      .populate("items.product items.variant coupon.couponId user")
      .populate("payments");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    validateUserOwnership(order, req.user._id, "order");
    res.json(order);
  } catch (error) {
    logger.error("Get order failed", {
      error: error.message,
      orderId: req.params.id,
    });
    res.status(400).json({ message: error.message });
  }
};

/**
 * List Orders
 */
export const listOrders = async (req, res) => {
  try {
    const { userId, page = 1, limit = 20, status } = req.query;
    const q = {};

    if (userId) q.user = userId;
    if (status) q.status = status;

    const orders = await Order.find(q)
      .populate("items.product")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json(orders);
  } catch (error) {
    logger.error("List orders failed", { error: error.message });
    res.status(400).json({ message: error.message });
  }
};

/**
 * Cancel Order
 */
export const cancelOrder = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { id } = req.params;
    const { reason = "" } = req.body;

    const order = await Order.findById(id).session(session);
    if (!order) {
      throw new Error("Order not found");
    }

    validateUserOwnership(order, req.user._id, "order");

    if (!["pending", "confirmed", "processing"].includes(order.status)) {
      throw new Error("Order cannot be cancelled in its current state");
    }

    // Release stock reservations
    await releaseStockReservation(order._id, null, session);

    // Refund payments if already paid
    if (["confirmed", "processing"].includes(order.status)) {
      const successfulPayments = await Payment.find({
        order: order._id,
        status: "success",
      }).session(session);

      for (const payment of successfulPayments) {
        if (payment.method === "wallet") {
          await processWalletRefund(
            order.user,
            payment.amount,
            order._id,
            `Refund due to order cancellation: ${reason}`,
            session
          );
        }
        // For gateway payments, you might want to initiate refund via gateway
        payment.status = "refunded";
        payment.meta.cancellationReason = reason;
        await payment.save({ session });
      }
    }

    // Update order status
    order.status = "cancelled";
    order.meta.cancellation = {
      reason,
      cancelledAt: new Date(),
      cancelledBy: req.user._id,
    };
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    logger.info("Order cancelled", { orderId: order._id, reason });
    res.json({ ok: true, order });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    logger.error("Order cancellation failed", {
      error: error.message,
      orderId: req.params.id,
    });

    res.status(400).json({ message: error.message });
  }
};

/**
 * Cleanup Expired Reservations
 */
export const cleanupExpiredReservations = async () => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const expiredReservations = await StockReservation.find({
      status: "active",
      reservedUntil: { $lt: new Date() },
    }).session(session);

    for (const reservation of expiredReservations) {
      logger.info("Cleaning up expired reservation", {
        reservationId: reservation._id,
        orderId: reservation.order,
      });

      // Release stock
      for (const it of reservation.items) {
        await incrementVariantStock(it.variant, it.qty, session);
      }

      // Update reservation status
      reservation.status = "expired";
      await reservation.save({ session });

      // Revert coupon usage if any
      const order = await Order.findById(reservation.order).session(session);
      if (order && order.coupon && order.coupon.couponId) {
        await revertCouponReservation(order.coupon.couponId, null, session);
      }

      // Update order status
      if (order && order.status === "pending") {
        order.status = "failed";
        order.meta.failureReason = "reservation_expired";
        await order.save({ session });
      }

      logger.info("Expired reservation cleaned up", {
        reservationId: reservation._id,
      });
    }

    await session.commitTransaction();
    session.endSession();

    return { cleaned: expiredReservations.length };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error("Reservation cleanup failed", { error: error.message });
    throw error;
  }
};

export default {
  createOrder,
  createPaymentSession,
  getPaymentStatus,
  paymentWebhook,
  getOrder,
  listOrders,
  cancelOrder,
  cleanupExpiredReservations,
};
