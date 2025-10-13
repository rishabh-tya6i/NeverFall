// controllers/orderController.js
import mongoose from "mongoose";
import Order from "../Models/Order.js";
import Cart from "../Models/Cart.js";
import Product from "../Models/Product.js";
import ProductVariant from "../Models/ProductVariant.js";
import Coupon from "../Models/Coupon.js";
import Payment from "../Models/Payments.js";
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
        price: { type: Number, required: true }, // Store price at reservation time
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

/**
 * Payment State Machine
 */
const PAYMENT_STATE_MACHINE = {
  created: ["attempted", "success", "failed", "cancelled"],
  attempted: ["success", "failed", "cancelled"],
  success: ["refunded", "partially_refunded"],
  failed: ["created", "cancelled"],
  cod_pending: ["success", "cancelled"],
  cancelled: [],
  refunded: [],
  partially_refunded: ["refunded"],
};

/**
 * Order State Machine
 */
const ORDER_STATE_MACHINE = {
  pending: ["confirmed", "cancelled", "failed"],
  confirmed: ["processing", "cancelled"],
  processing: ["out-for-delivery", "cancelled"],
  "out-for-delivery": ["delivered", "return-requested"],
  delivered: ["return-requested", "refunded"],
  "return-requested": ["returned", "picked-up", "exchange-requested"],
  returned: ["refunded"],
  "exchange-requested": ["exchange-approved", "exchange-rejected"],
  "exchange-approved": ["exchanged", "picked-up"],
  "picked-up": ["refunded", "exchanged"],
  exchanged: [],
  "exchange-rejected": ["returned"],
  refunded: [],
  cancelled: [],
  failed: [],
};

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

  if (walletAvailable < amount) {
    throw new Error(
      `Insufficient wallet balance. Available: ${walletAvailable}, Required: ${amount}`
    );
  }

  // Create wallet transaction
  const walletTx = await WalletTransaction.create(
    [
      {
        user: userId,
        type: "debit",
        amount: amount,
        currency: "INR",
        status: "available",
        source: "order",
        refId: orderId,
        meta: { note: "Wallet debit for order payment" },
      },
    ],
    { session }
  );

  // Update user balance
  user.wallet.balance = walletAvailable - amount;
  await user.save({ session });

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

// ========== WEBHOOKS & AUTO-MANAGEMENT ==========

/**
 * Automatic Reservation Cleanup Service
 * Run this periodically to clean up expired reservations
 */
export async function cleanupExpiredReservations() {
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
        await revertCouponReservation(
          order.coupon.couponId,
          null, // We don't have usageRecordId here, would need to store it
          session
        );
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
}

/**
 * Payment Failure Auto-Handler
 */
export async function handlePaymentFailure(paymentId, reason = "unknown") {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const payment = await Payment.findById(paymentId).session(session);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    logger.info("Handling payment failure", { paymentId, reason });

    // Refund any wallet payments for this order
    const walletPayments = await Payment.find({
      order: payment.order,
      method: "wallet",
      status: "success",
    }).session(session);

    for (const wp of walletPayments) {
      await processWalletRefund(
        wp.user,
        wp.amount,
        wp.order,
        `Refund due to payment failure: ${reason}`,
        session
      );
      wp.status = "refunded";
      wp.meta.refundReason = "payment_failure";
      await wp.save({ session });
    }

    // Release stock reservations
    await releaseStockReservation(payment.order, paymentId, session);

    // Revert coupon usage
    const order = await Order.findById(payment.order).session(session);
    if (order && order.coupon && order.coupon.couponId) {
      await revertCouponReservation(
        order.coupon.couponId,
        null, // Would need usageRecordId stored somewhere
        session
      );
    }

    // Update payment status
    validateStateTransition(payment.status, "failed", PAYMENT_STATE_MACHINE);
    payment.status = "failed";
    payment.meta.failureReason = reason;
    await payment.save({ session });

    // Update order status
    if (order) {
      validateStateTransition(order.status, "failed", ORDER_STATE_MACHINE);
      order.status = "failed";
      order.meta.paymentFailure = { paymentId, reason, timestamp: new Date() };
      await order.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    logger.info("Payment failure handled successfully", { paymentId });
    return { success: true, paymentId };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error("Payment failure handling failed", {
      paymentId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Webhook for Gateway Notifications
 */
export const paymentWebhook = async (req, res) => {
  const gateway = req.params.gateway; // razorpay, payu, etc
  const payload = req.body;

  try {
    logger.info("Payment webhook received", { gateway, payload });

    const adapter = await getActiveGatewayAdapter();
    const verification = await adapter.verifyWebhook(payload);

    if (!verification.valid) {
      logger.warn("Invalid webhook signature", { gateway });
      return res.status(400).json({ error: "Invalid signature" });
    }

    const { paymentId, status, gatewayPaymentId, amount, currency } =
      verification;

    // Find payment record
    const payment = await Payment.findOne({
      gatewayPaymentId: gatewayPaymentId,
    });

    if (!payment) {
      logger.error("Payment not found for webhook", { gatewayPaymentId });
      return res.status(404).json({ error: "Payment not found" });
    }

    switch (status) {
      case "success":
        await confirmPayment({
          params: { paymentId: payment._id },
          body: { gatewayPayload: payload },
        });
        break;

      case "failed":
        await handlePaymentFailure(payment._id, "gateway_failure");
        break;

      case "refunded":
        // Handle refund webhook
        await processGatewayRefund(payment, payload);
        break;
    }

    res.json({ ok: true });
  } catch (error) {
    logger.error("Payment webhook error", {
      gateway,
      error: error.message,
      payload,
    });
    res.status(500).json({ error: "Webhook processing failed" });
  }
};

// ========== MAIN CONTROLLER ACTIONS ==========

/**
 * Create Order (Buy Now/Cart)
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
 * Make Payment - Core payment processing
 */
export const makePayment = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { orderId } = req.params;
    const {
      method,
      useWallet = false,
      idempotencyKey = generateIdempotencyKey(),
    } = req.body;
    const userId = req.user?._id || req.body.userId;

    if (!["cod", "wallet", "razorpay", "payu"].includes(method)) {
      throw new Error("Unsupported payment method");
    }

    const order = await Order.findById(orderId).session(session);
    if (!order) throw new Error("Order not found");
    validateUserOwnership(order, userId, "order");

    if (order.status !== "pending") {
      throw new Error("Order not in payable state");
    }

    logger.info("Starting payment process", {
      orderId,
      method,
      useWallet,
      userId,
    });

    // Revalidate prices and stock
    const { validatedItems, serverSubtotal } =
      await validateAndRecalculatePrices(order.items, session);
    order.items = validatedItems;

    // Reserve coupon usage atomically
    let discountAmount = order.discountAmount || 0;
    let couponReservedMeta = { couponId: null, usageRecordId: null };

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
        serverSubtotal,
        applicableSubtotal,
        session
      );

      couponReservedMeta.couponId = reserved.coupon._id;
      couponReservedMeta.usageRecordId = reserved.usageRecord?._id || null;

      // Recalculate discount with reserved coupon
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

    const totalPayable = Math.max(0, serverSubtotal - discountAmount);

    // Reserve stock atomically
    for (const it of order.items) {
      await decrementVariantStockAtomic(it.variant, it.quantity, session);
    }

    // Create stock reservation
    const reservation = await createStockReservation(
      order._id,
      order.items,
      null, // paymentId will be set later
      session
    );

    // Process wallet payment if requested
    let remaining = totalPayable;
    const paymentSnapshots = [];

    if (useWallet) {
      const walletTx = await processWalletPayment(
        userId,
        remaining,
        order._id,
        session
      );

      const walletPayment = new Payment({
        order: order._id,
        user: userId,
        method: "wallet",
        amount: remaining,
        currency: "INR",
        gatewayPaymentId: null,
        status: "success",
        meta: { walletTxId: walletTx._id },
        idempotencyKey,
      });
      await walletPayment.save({ session });

      paymentSnapshots.push({
        method: "wallet",
        amount: remaining,
        gatewayPaymentId: null,
        status: "success",
        meta: { walletTxId: walletTx._id },
      });

      remaining = 0;
    }

    // Handle remaining amount based on payment method
    if (remaining <= 0) {
      // Fully paid by wallet
      await finalizeOrderPayment(
        order,
        paymentSnapshots,
        "wallet",
        discountAmount,
        totalPayable,
        reservation,
        userId,
        session
      );

      await session.commitTransaction();
      session.endSession();

      logger.info("Order fully paid by wallet", { orderId: order._id });
      return res.json({
        ok: true,
        order,
        message: "Order paid fully by wallet",
      });
    }

    if (method === "cod") {
      const codPayment = new Payment({
        order: order._id,
        user: userId,
        method: "cod",
        amount: remaining,
        currency: "INR",
        gatewayPaymentId: null,
        status: "cod_pending",
        meta: {},
        idempotencyKey,
      });
      await codPayment.save({ session });

      paymentSnapshots.push({
        method: "cod",
        amount: remaining,
        gatewayPaymentId: null,
        status: "cod_pending",
        meta: {},
      });

      // Link reservation to COD payment
      reservation.payment = codPayment._id;
      await reservation.save({ session });

      await finalizeOrderPayment(
        order,
        paymentSnapshots,
        "cod",
        discountAmount,
        totalPayable,
        reservation,
        userId,
        session
      );

      await session.commitTransaction();
      session.endSession();

      logger.info("COD order confirmed", { orderId: order._id });
      return res.json({
        ok: true,
        order,
        message: "Order confirmed as COD",
      });
    }

    // Online payment gateway flow
    if (["razorpay", "payu"].includes(method)) {
      const gatewayPayment = new Payment({
        order: order._id,
        user: userId,
        method,
        amount: remaining,
        currency: "INR",
        gatewayPaymentId: null,
        status: "created",
        meta: {},
        idempotencyKey,
      });
      await gatewayPayment.save({ session });

      paymentSnapshots.push({
        method,
        amount: remaining,
        gatewayPaymentId: null,
        status: "created",
        meta: {},
      });

      // Update order with payment info but don't finalize yet
      order.payments = paymentSnapshots;
      order.paymentMethod = method;
      order.discountAmount = discountAmount;
      order.total = totalPayable;
      await order.save({ session });

      // Link reservation to gateway payment
      reservation.payment = gatewayPayment._id;
      await reservation.save({ session });

      await session.commitTransaction();
      session.endSession();

      // Call gateway outside transaction
      const adapter = await getActiveGatewayAdapter();
      const gatewayPayload = await adapter.createOrder({
        amount: remaining,
        currency: "INR",
        receipt: `order_${order._id}`,
        notes: {
          orderId: order._id.toString(),
          paymentId: gatewayPayment._id.toString(),
          userId: userId.toString(),
        },
      });

      // Update payment with gateway order ID if available
      if (gatewayPayload.id) {
        await Payment.findByIdAndUpdate(gatewayPayment._id, {
          gatewayPaymentId: gatewayPayload.id,
        });
      }

      logger.info("Gateway payment initiated", {
        orderId: order._id,
        paymentId: gatewayPayment._id,
        gateway: method,
      });

      return res.json({
        ok: true,
        orderId: order._id,
        paymentId: gatewayPayment._id,
        gateway: gatewayPayload,
      });
    }

    throw new Error("Unsupported payment method");
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    logger.error("Make payment failed", {
      error: err.message,
      orderId: req.params.orderId,
      userId: req.user?._id,
    });

    return res.status(400).json({
      message: err.message || "Payment processing failed",
    });
  }
};

/**
 * Confirm Payment - Gateway callback handler
 */
export const confirmPayment = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { paymentId } = req.params;
    const { gatewayPayload = {} } = req.body;

    const payment = await Payment.findById(paymentId).session(session);
    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.status === "success") {
      await session.commitTransaction();
      session.endSession();
      return res.status(200).json(payment);
    }

    // Verify payment with gateway
    const adapter = await getActiveGatewayAdapter();
    const verification = await adapter.verifyPayment(gatewayPayload);

    if (!verification.valid) {
      throw new Error("Payment verification failed");
    }

    // Update payment status
    validateStateTransition(payment.status, "success", PAYMENT_STATE_MACHINE);
    payment.status = "success";
    payment.gatewayPaymentId =
      verification.gatewayPaymentId || payment.gatewayPaymentId;
    payment.meta = {
      ...payment.meta,
      gatewayPayload: verification,
      verifiedAt: new Date(),
    };
    await payment.save({ session });

    // Get and update order
    const order = await Order.findById(payment.order).session(session);
    if (!order) {
      throw new Error("Associated order not found");
    }

    // Update payment snapshot in order
    const paymentSnapshot = order.payments.find(
      (p) =>
        p.method === payment.method &&
        Math.abs(p.amount - payment.amount) < 0.01
    );

    if (paymentSnapshot) {
      paymentSnapshot.status = "success";
      paymentSnapshot.gatewayPaymentId = payment.gatewayPaymentId;
    }

    // Finalize order
    await finalizeOrderPayment(
      order,
      order.payments,
      payment.method,
      order.discountAmount,
      order.total,
      null, // reservation will be found by paymentId
      order.user,
      session,
      payment._id
    );

    await session.commitTransaction();
    session.endSession();

    logger.info("Payment confirmed successfully", {
      paymentId,
      orderId: order._id,
    });

    return res.json({
      ok: true,
      order,
      payment,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    logger.error("Payment confirmation failed", {
      error: err.message,
      paymentId: req.params.paymentId,
    });

    // Auto-handle failure
    if (req.params.paymentId) {
      await handlePaymentFailure(req.params.paymentId, "confirmation_failed");
    }

    return res.status(400).json({
      message: err.message || "Payment confirmation failed",
    });
  }
};

// ========== HELPER FUNCTIONS ==========

async function finalizeOrderPayment(
  order,
  paymentSnapshots,
  paymentMethod,
  discountAmount,
  total,
  reservation,
  userId,
  session,
  paymentId = null
) {
  // Update order
  order.payments = paymentSnapshots;
  order.paymentMethod = paymentMethod;
  order.discountAmount = discountAmount;
  order.total = total;
  validateStateTransition(order.status, "confirmed", ORDER_STATE_MACHINE);
  order.status = "confirmed";
  order.meta.paidAt = new Date();
  await order.save({ session });

  // Consume stock reservation
  if (reservation) {
    await consumeStockReservation(order._id, reservation.payment, session);
  } else if (paymentId) {
    await consumeStockReservation(order._id, paymentId, session);
  }

  // Clear user's cart
  await Cart.updateOne(
    { user: userId },
    { $set: { items: [], totalValue: 0 } }
  ).session(session);

  logger.info("Order finalized", { orderId: order._id, paymentMethod });
}

// ========== ADDITIONAL CONTROLLER ACTIONS ==========

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
    validateStateTransition(order.status, "cancelled", ORDER_STATE_MACHINE);
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

// Export webhook handlers
//  export { handlePaymentFailure, cleanupExpiredReservations, paymentWebhook };
