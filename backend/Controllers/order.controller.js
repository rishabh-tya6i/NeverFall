// controllers/orderController.js
import mongoose from "mongoose";
import Order from "../Models/Order.js";
import Cart from "../Models/Cart.js";
import ProductVariant from "../Models/ProductVariant.js";
import Coupon from "../Models/Coupon.js";
import Payment from "../Models/Payments.js";
import PaymentSession from "../Models/PaymentSession.js";
import User from "../Models/User.js";
import WalletTransaction from "../Models/WalletTransaction.js";
import { getActiveGatewayAdapter } from "../Services/gatewayFactory.js";
import { cacheGet, cacheSet, cacheDelPattern } from "../lib/cache.js";
import { redis } from "../lib/redis.js";
import logger from "../utils/logger.js";

// ========== UTILITY FUNCTIONS ==========

function generateIdempotencyKey() {
  return `idemp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Improved Redis-based distributed lock with shorter timeout and stale lock detection
/**
 * Acquire a Redis-based payment lock (concurrency-safe)
 * @param {String} orderId
 * @param {Number} timeoutMs - lock expiry in milliseconds
 */
async function acquirePaymentLock(
  orderId,
  timeoutMs = 15000,
  retries = 3,
  delayMs = 150
) {
  const lockKey = `payment_lock:${orderId}`;
  const lockValue = Date.now().toString();

  for (let i = 0; i < retries; i++) {
    const acquired = await redis.set(lockKey, lockValue, "PX", timeoutMs, "NX");
    if (acquired) {
      return lockKey;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(
    "Payment session is currently being processed. Please try again in a few seconds."
  );
}

/**
 * Release payment lock
 */
async function releasePaymentLock(lockKey) {
  try {
    await redis.del(lockKey);
  } catch (err) {
    // Log failure but do not block payment flow
    logger.warn("Failed to release payment lock", {
      lockKey,
      error: err.message,
    });
  }
}

/**
 * Check if an active payment session exists for this order
 * @param {String} orderId
 * @param {String} currentSessionId - optional, for retries
 */
async function checkActivePaymentSession(orderId, currentSessionId = null) {
  const ACTIVE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes, can adjust for production

  const activeSession = await PaymentSession.findOne({
    order: orderId,
    status: "active",
    createdAt: { $gte: new Date(Date.now() - ACTIVE_WINDOW_MS) },
  });
  console.log("activeSession is", activeSession);
  if (activeSession) {
    // If same session (retry), allow it
    if (currentSessionId && activeSession.sessionId === currentSessionId)
      return true;

    // If session is stale (> 3 min), expire it
    const sessionAge = Date.now() - activeSession.createdAt.getTime();
    if (sessionAge > 3 * 60 * 1000) {
      await PaymentSession.updateOne(
        { _id: activeSession.id },
        { status: "expired" }
      );
      logger.info("Expired stale payment session", {
        sessionId: activeSession.sessionId,
        orderId,
      });
      return true;
    }

    throw new Error(
      "A payment is already in progress for this order. Please wait or refresh the page."
    );
  }

  return true;
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
 * Stock operations with Redis caching
 */
export async function decrementVariantStock(variantId, qty, session) {
  const result = await ProductVariant.updateOne(
    { _id: variantId, stock: { $gte: qty } },
    { $inc: { stock: -qty } },
    { session }
  );

  if (result.modifiedCount === 0) {
    throw new Error(`Insufficient stock for variant: ${variantId}`);
  }

  await cacheDelPattern(`product:*`);
  await cacheDelPattern(`variant:*`);
}

async function incrementVariantStock(variantId, qty, session) {
  await ProductVariant.updateOne(
    { _id: variantId },
    { $inc: { stock: qty } },
    { session }
  );

  await cacheDelPattern(`product:*`);
  await cacheDelPattern(`variant:*`);
}

/**
 * Calculate order totals with caching
 */
export async function calculateOrderTotals(items, couponCode, session, userId) {
  let subtotal = 0;
  const validatedItems = [];

  // 1️⃣ Validate items, calculate line totals
  for (const item of items) {
    const cacheKey = `variant:${item.variantId}`;
    let variant = await cacheGet(cacheKey);

    if (!variant) {
      variant = await ProductVariant.findById(item.variantId)
        .populate({
          path: "product",
          populate: {
            path: "parent",
            populate: { path: "categories" }, // populate product → parent → category
          },
        })
        .session(session);
      console.log("variant is", variant);

      if (variant) await cacheSet(cacheKey, variant, 300);
    }

    if (!variant) throw new Error(`Variant ${item.variantId} not found`);
    if (variant.stock < item.quantity)
      throw new Error(`Insufficient stock for ${variant.product.title}`);

    const price = variant.price;
    const lineTotal = price * item.quantity;

    validatedItems.push({
      product: variant.product._id,
      variant: variant._id,
      title: variant.product.title,
      color: item.color,
      size: item.size,
      price: price,
      quantity: item.quantity,
      lineTotal: lineTotal,
      priceAfterDiscount: lineTotal, // will adjust if coupon applies
      category: variant.product.parent?.categories?._id || null, // store category for coupon
    });
    console.log("validatedItems is", validatedItems);
    subtotal += lineTotal;
  }

  let discountAmount = 0;
  let couponData = { couponId: null, code: "", targetUser: null };
  let coupon = null;

  // 2️⃣ Process coupon if provided
  if (couponCode) {
    const cacheKey = `coupon:${couponCode.toUpperCase()}`;
    coupon = await cacheGet(cacheKey);

    if (!coupon) {
      coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        active: true,
        expiresAt: { $gt: new Date() },
      }).session(session);

      if (coupon) await cacheSet(cacheKey, coupon, 300);
    }

    if (coupon) {
      // 2a️⃣ Check usage limits
      if (coupon.maxUses && coupon.usesCount >= coupon.maxUses) {
        throw new Error("Coupon usage limit reached");
      }

      if (coupon.maxUsesPerUser) {
        const userUsage = await Order.countDocuments({
          "coupon.couponId": coupon._id,
          user: userId,
        }).session(session);
        if (userUsage >= coupon.maxUsesPerUser) {
          throw new Error("Coupon usage limit reached for this user");
        }
      }

      // 2b️⃣ Check min order value
      if (subtotal < coupon.minOrderValue) {
        throw new Error(
          `Order must be at least ₹${coupon.minOrderValue} to use this coupon`
        );
      }

      couponData = {
        couponId: coupon._id,
        code: coupon.code,
        targetUser: coupon.targetUser || null,
      };

      // 2c️⃣ Filter applicable items
      const applicableItems = validatedItems.filter((item) => {
        const isProductMatch =
          !coupon.applicableProductIds?.length ||
          coupon.applicableProductIds.includes(item.product);
        const isCategoryMatch =
          !coupon.applicableCategoryIds?.length ||
          coupon.applicableCategoryIds.includes(item.category);
        return isProductMatch && isCategoryMatch;
      });

      const applicableSubtotal = applicableItems.reduce(
        (sum, item) => sum + item.lineTotal,
        0
      );

      // 2d️⃣ Calculate discount amount
      if (coupon.type === "fixed") {
        discountAmount = Math.min(coupon.value, applicableSubtotal);
      } else if (coupon.type === "percentage") {
        discountAmount = (applicableSubtotal * coupon.value) / 100;
        if (coupon.maxDiscountAmount) {
          discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
        }
      }

      // 2e️⃣ Distribute discount proportionally across applicable items
      for (const item of applicableItems) {
        const proportion = item.lineTotal / applicableSubtotal;
        const itemDiscount = proportion * discountAmount;
        item.priceAfterDiscount =
          Math.round((item.lineTotal - itemDiscount) * 100) / 100;
      }
    }
  }

  const total = Math.max(0, subtotal - discountAmount);

  return {
    items: validatedItems,
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
    coupon: couponData,
  };
}

/**
 * Reserve coupon usage with cache invalidation
 */
/**
 * Reserve coupon usage safely (atomic + concurrency-safe)
 */
export async function reserveCouponUsage(couponId, userId, session) {
  if (!couponId) return;

  const result = await Coupon.updateOne(
    {
      _id: couponId,
      $expr: { $lt: ["$usesCount", { $ifNull: ["$maxUses", Infinity] }] },
    },
    { $inc: { usesCount: 1 } },
    { session }
  );

  if (result.modifiedCount === 0) {
    throw new Error("Coupon usage limit reached");
  }

  // Clear coupon cache
  await cacheDelPattern(`coupon:*`);
}

/**
 * Revert coupon usage safely (atomic)
 */
async function revertCouponUsage(couponId, userId, session) {
  if (!couponId) return;

  await Coupon.updateOne(
    { _id: couponId, usesCount: { $gt: 0 } },
    { $inc: { usesCount: -1 } },
    { session }
  );

  // Clear coupon cache
  await cacheDelPattern(`coupon:*`);
}

/**
 * Wallet operations - ONLY CALLED AFTER PAYMENT CONFIRMATION
 */
async function processWalletPayment(userId, amount, orderId, session) {
  const user = await User.findById(userId).session(session);

  if (!user.wallet || user.wallet.balance < amount) {
    throw new Error("Insufficient wallet balance");
  }

  const walletTx = await WalletTransaction.create(
    [
      {
        user: userId,
        type: "debit",
        amount: amount,
        status: "completed",
        source: "order_payment",
        refId: orderId,
      },
    ],
    { session }
  );

  user.wallet.balance -= amount;
  await user.save({ session });

  await cacheDelPattern(`user:${userId}:*`);

  return walletTx[0];
}

async function processWalletRefund(userId, amount, orderId, reason, session) {
  const user = await User.findById(userId).session(session);

  const walletTx = await WalletTransaction.create(
    [
      {
        user: userId,
        type: "credit",
        amount: amount,
        status: "completed",
        source: "refund",
        refId: orderId,
        meta: { reason },
      },
    ],
    { session }
  );

  user.wallet.balance = (user.wallet.balance || 0) + amount;
  await user.save({ session });

  await cacheDelPattern(`user:${userId}:*`);

  return walletTx[0];
}

// ========== CONTROLLER ACTIONS ==========

/**
 * Create Order
 */
export const createOrder = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const {
        items: payloadItems = [],
        useCart = false,
        couponCode = null,
        shippingAddress,
      } = req.body;

      const userId = req.user.id;
      console.log("userId is", userId);
      if (!shippingAddress) {
        throw new Error("Shipping address required");
      }

      let items = [];
      if (useCart) {
        const cart = await Cart.findOne({ user: userId }).session(session);
        console.log("cart is", cart);
        if (!cart?.items?.length) throw new Error("Cart is empty");
        items = cart.items.map((item) => ({
          variantId: item.variant,
          quantity: item.quantity,
          color: item.color,
          size: item.size,
        }));
      } else {
        if (!payloadItems.length) throw new Error("No items provided");
        items = payloadItems;
      }

      const {
        items: validatedItems,
        subtotal,
        discountAmount,
        total,
        coupon,
      } = await calculateOrderTotals(items, couponCode, session, userId);

      // Reserve stock
      for (const item of validatedItems) {
        await decrementVariantStock(item.variant, item.quantity, session);
      }

      // Reserve coupon
      if (coupon.couponId) {
        await reserveCouponUsage(coupon.couponId, userId, session);
      }

      const order = await Order.create(
        [
          {
            user: userId,
            items: validatedItems,
            subtotal,
            discountAmount,
            total,
            coupon,
            shippingAddress,
            status: "pending",
            meta: {
              idempotencyKey:
                req.header("Idempotency-Key") || generateIdempotencyKey(),
            },
          },
        ],
        { session }
      );

      await cacheDelPattern(`orders:${userId}:*`);

      res.status(201).json(order[0]);
    });
  } catch (error) {
    logger.error("Order creation failed", {
      error: error.message,
      userId: req.user._id,
    });
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

/**
 * Create Payment Session - UPDATED: No wallet deduction here
 */
export const createPaymentSession = async (req, res) => {
  const session = await mongoose.startSession();
  let paymentLock = null;
  const orderId = req.params.id;

  try {
    // --- 1. Acquire Redis lock for this order BEFORE the transaction ---
    paymentLock = await acquirePaymentLock(orderId, 15000); // 15s lock

    const result = await session.withTransaction(async () => {
      const {
        useWallet = false,
        paymentMethod = "cod",
        retrySessionId = null,
      } = req.body;
      const userId = req.user.id;
      const sessionId = retrySessionId || generateSessionId();

      const validMethods = ["cod", "razorpay", "payu"];
      if (!validMethods.includes(paymentMethod)) {
        throw new Error("Unsupported payment method");
      }

      // --- 2. Ensure no conflicting active payment session ---
      if (paymentMethod !== "cod") {
        await checkActivePaymentSession(orderId, retrySessionId);
      }

      // --- 3. Load order + user ---
      const [order, user] = await Promise.all([
        Order.findById(orderId).session(session),
        User.findById(userId).session(session),
      ]);

      if (!order) throw new Error("Order not found");

      // --- 4. Early return if already confirmed ---
      if (order.status === "confirmed") {
        return {
          success: true,
          sessionId,
          orderStatus: "confirmed",
          message: "Order already confirmed",
        };
      }

      if (order.status !== "pending") {
        throw new Error(
          `Order cannot be paid. Current status: ${order.status}`
        );
      }

      validateUserOwnership(order, userId, "order");

      // --- 5. Calculate wallet reserve amount ---
      let walletAmount = 0;
      let gatewayAmount = order.total;

      if (useWallet && user.wallet?.balance > 0) {
        walletAmount = Math.min(user.wallet.balance, order.total);
        gatewayAmount = order.total - walletAmount;
      }

      // --- 6. Find existing retry session ---
      let existingSession = null;
      if (retrySessionId) {
        existingSession = await PaymentSession.findOne({
          sessionId: retrySessionId,
          order: orderId,
        }).session(session);
      }

      // --- 7. Create or update PaymentSession ---
      let paymentSession;
      if (existingSession) {
        paymentSession = existingSession;
        paymentSession.status = "active";
        paymentSession.walletAmount = walletAmount;
        paymentSession.paymentMethod = paymentMethod;
        paymentSession.retryCount = (paymentSession.retryCount || 0) + 1;
        paymentSession.lastRetryAt = new Date();
        await paymentSession.save({ session });
      } else {
        const created = await PaymentSession.create(
          [
            {
              sessionId,
              user: userId,
              order: orderId,
              walletAmount,
              paymentMethod,
              status: "active",
              retryCount: 0,
            },
          ],
          { session }
        );
        paymentSession = created[0];
      }

      let gatewayPayload = null;

      if (paymentMethod === "cod") {
        // --- COD flow ---
        if (walletAmount > 0) {
          const walletTx = await processWalletPayment(
            userId,
            walletAmount,
            orderId,
            session
          );
          order.payments.push({
            method: "wallet",
            amount: walletAmount,
            status: "success",
            meta: { walletTransactionId: walletTx._id },
          });
        }

        order.payments.push({
          method: "cod",
          amount: gatewayAmount,
          status: "cod_pending",
        });

        order.status = "confirmed";
        order.paymentMethod = "cod";
        await order.save({ session });

        paymentSession.status = "completed";
        paymentSession.completedAt = new Date();
        // const cart = await Cart.findOne({ user: userId }).session(session);
        // if (cart) {
        //   cart.items = [];
        //   cart.totalValue = 0;
        //   await cart.save({ session });
        // }
        await paymentSession.save({ session });
      } else {
        // --- Online payment flow ---
        const adapter = await getActiveGatewayAdapter();
        gatewayPayload = await adapter.createOrder({
          amount: gatewayAmount,
          currency: "INR",
          receipt: `order_${orderId}_${sessionId}`,
          notes: {
            orderId: orderId.toString(),
            sessionId,
            userId: userId.toString(),
            walletAmount: walletAmount.toString(),
          },
        });

        paymentSession.gatewayOrderId = gatewayPayload?.id;
        paymentSession.walletAmount = walletAmount; // reserved
        await paymentSession.save({ session });

        order.paymentMethod = paymentMethod;
        await order.save({ session });
      }

      // --- 8. Clear caches ---
      await cacheDelPattern(`orders:${userId}:*`);
      await cacheDelPattern(`order:${orderId}`);

      // --- 9. Return session info from transaction ---
      return {
        success: true,
        sessionId: paymentSession.sessionId,
        orderId: orderId,
        gateway: gatewayPayload,
        walletAmount,
        gatewayAmount,
        paymentMethod,
        orderStatus: paymentMethod === "cod" ? "confirmed" : "pending",
        isRetry: !!retrySessionId,
      };
    }); // End of withTransaction

    // --- 10. Release the lock BEFORE sending the response ---
    if (paymentLock) {
      await releasePaymentLock(paymentLock);
      paymentLock = null; // To prevent double-release in finally block
    }

    // --- 11. Send response AFTER transaction and lock release ---
    res.json(result);
  } catch (error) {
    logger.error("Payment session creation failed", {
      error: error.message,
      orderId: orderId,
    });
    res.status(400).json({ message: error.message });
  } finally {
    // --- 12. Safeguard: release lock if something failed before the success path ---
    if (paymentLock) {
      await releasePaymentLock(paymentLock);
    }
    session.endSession();
  }
};

/**
 * Verify and Process Payment - FRONTEND CALLBACK ENDPOINT
 */
export const verifyPayment = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const { sessionId, gatewayPaymentId, gatewayOrderId, gatewaySignature } =
        req.body;

      const userId = req.user._id;

      // Find payment session
      const paymentSession = await PaymentSession.findOne({
        sessionId,
        user: userId,
      }).session(session);

      if (!paymentSession) {
        throw new Error("Payment session not found");
      }

      // If already processed, return success
      if (paymentSession.status === "completed") {
        const order = await Order.findById(paymentSession.order).session(
          session
        );
        return res.json({
          success: true,
          orderId: order._id,
          orderStatus: order.status,
          message: "Payment already processed",
        });
      }

      // Verify payment with gateway
      const adapter = await getActiveGatewayAdapter();
      const verification = await adapter.verifyPayment({
        gatewayPaymentId,
        gatewayOrderId: gatewayOrderId || paymentSession.gatewayOrderId,
        gatewaySignature,
      });

      if (!verification.valid) {
        throw new Error("Payment verification failed");
      }

      const order = await Order.findById(paymentSession.order).session(session);

      // NOW process wallet payment (only after gateway payment is confirmed)
      if (paymentSession.walletAmount > 0) {
        const walletTx = await processWalletPayment(
          userId,
          paymentSession.walletAmount,
          order._id,
          session
        );

        order.payments.push({
          method: "wallet",
          amount: paymentSession.walletAmount,
          status: "success",
          meta: { walletTransactionId: walletTx._id },
        });
      }

      // Add gateway payment record
      order.payments.push({
        method: paymentSession.paymentMethod,
        amount: verification.amount,
        gatewayPaymentId,
        status: "success",
        meta: { verification },
      });

      order.status = "confirmed";
      await order.save({ session });

      // Mark session as completed
      paymentSession.status = "completed";
      paymentSession.completedAt = new Date();
      paymentSession.gatewayPaymentId = gatewayPaymentId;
      await paymentSession.save({ session });

      // --- CLEAR USER CART AFTER PAYMENT SUCCESS ---
      await Cart.deleteMany({ user: userId }).session(session);

      // Clear cache
      await cacheDelPattern(`orders:${userId}:*`);
      await cacheDelPattern(`order:${order._id}`);

      logger.info("Payment verified successfully", {
        sessionId,
        orderId: order._id,
        gatewayAmount: verification.amount,
        walletAmount: paymentSession.walletAmount,
      });

      res.json({
        success: true,
        orderId: order._id,
        orderStatus: order.status,
      });
    });
  } catch (error) {
    logger.error("Payment verification failed", {
      error: error.message,
      sessionId: req.body.sessionId,
    });

    // If verification fails, trigger payment failure
    if (req.body.sessionId) {
      try {
        await handlePaymentFailure(
          {
            body: {
              sessionId: req.body.sessionId,
              reason: `verification_failed: ${error.message}`,
            },
          },
          { json: () => {} }
        );
      } catch (fallbackError) {
        logger.error("Fallback failure handling also failed", {
          error: fallbackError.message,
        });
      }
    }

    res.status(400).json({
      success: false,
      message: error.message,
    });
  } finally {
    session.endSession();
  }
};

/**
 * Handle Payment Failure
 */
export const handlePaymentFailure = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const { sessionId, reason = "unknown" } = req.body;

      const paymentSession = await PaymentSession.findOneAndUpdate(
        { sessionId },
        { status: "failed", meta: { failureReason: reason } },
        { session, new: true }
      );

      if (!paymentSession) {
        return res.json({ success: false, message: "Session not found" });
      }

      const order = await Order.findById(paymentSession.order).session(session);

      // Return stock
      for (const item of order.items) {
        await incrementVariantStock(item.variant, item.quantity, session);
      }

      // Revert coupon
      if (order.coupon?.couponId) {
        await revertCouponUsage(order.coupon.couponId, order.user, session);
      }

      // No wallet refund needed since we never deducted it!
      // Wallet amount is only deducted after successful payment verification

      order.status = "failed";
      await order.save({ session });

      // Clear cache
      await cacheDelPattern(`orders:${order.user}:*`);
      await cacheDelPattern(`order:${order._id}`);

      res.json({ success: true });
    });
  } catch (error) {
    logger.error("Payment failure handling failed", { error: error.message });
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

/**
 * Check Payment Status - For frontend polling
 */
export const checkPaymentStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const paymentSession = await PaymentSession.findOne({ sessionId });

    if (!paymentSession) {
      return res.json({
        status: "not_found",
        message: "Payment session not found",
      });
    }

    const order = await Order.findById(paymentSession.order);

    res.json({
      status: paymentSession.status,
      orderStatus: order?.status,
      sessionId: paymentSession.sessionId,
      orderId: paymentSession.order,
      paymentMethod: paymentSession.paymentMethod,
      walletAmount: paymentSession.walletAmount,
      completedAt: paymentSession.completedAt,
    });
  } catch (error) {
    logger.error("Check payment status failed", { error: error.message });
    res.status(400).json({ message: error.message });
  }
};

// Keep other functions (getOrder, listOrders, cancelOrder) as they were
export const getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `order:${id}`;

    let order = await cacheGet(cacheKey);

    if (!order) {
      order = await Order.findById(id).populate("items.product items.variant");
      if (!order) return res.status(404).json({ message: "Order not found" });

      await cacheSet(cacheKey, order, 600);
    }

    validateUserOwnership(order, req.user.id, "order");
    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const listOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const userId = req.user.id;
    console.log("userId is", userId);
    const cacheKey = `orders:${userId}:${page}:${limit}:${status || "all"}`;

    let orders = await cacheGet(cacheKey);

    if (!orders) {
      const query = { user: userId };
      if (status) query.status = status;

      orders = await Order.find(query)
        .populate("items.product")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit));

      await cacheSet(cacheKey, orders, 300);
    }

    res.json(orders);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const cancelOrder = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { id } = req.params;
      const { reason = "" } = req.body;

      const order = await Order.findById(id).session(session);
      if (!order) throw new Error("Order not found");

      validateUserOwnership(order, req.user.id, "order");

      if (!["pending", "confirmed"].includes(order.status)) {
        throw new Error("Order cannot be cancelled");
      }

      // Return stock
      for (const item of order.items) {
        await incrementVariantStock(item.variant, item.quantity, session);
      }

      // Refund wallet payments (only if order was confirmed)
      if (order.status === "confirmed") {
        for (const payment of order.payments) {
          if (payment.method === "wallet" && payment.status === "success") {
            await processWalletRefund(
              order.user,
              payment.amount,
              order._id,
              `Cancellation: ${reason}`,
              session
            );
          }
        }
      }

      // Revert coupon
      if (order.coupon?.couponId) {
        await revertCouponUsage(order.coupon.couponId, order.user, session);
      }

      order.status = "cancelled";
      await order.save({ session });

      await cacheDelPattern(`orders:${order.user}:*`);
      await cacheDelPattern(`order:${order._id}`);

      res.json({ success: true, order });
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

export default {
  createOrder,
  createPaymentSession,
  verifyPayment, // NEW: Frontend callback endpoint
  checkPaymentStatus, // NEW: For frontend polling
  handlePaymentFailure,
  getOrder,
  listOrders,
  cancelOrder,
};
