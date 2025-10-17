// services/order.service.js
import Order from "../Models/Order.js";

import {
  reserveCouponUsage,
  decrementVariantStock,
  calculateOrderTotals,
} from "../Controllers/order.controller.js";
import { cacheDelPattern } from "../lib/cache.js";
// import Payment from "../models/Payment.js";

export async function createOrderFromSelection(payload, session) {
  // payload: { userId, items, paymentMethod, walletTxId, couponCode, meta, shippingAddress }
  const {
    userId,
    items,
    paymentMethod = "none",
    walletTxId = null,
    couponCode = null,
    meta = {},
    shippingAddress = null,
  } = payload;

  // if shippingAddress mandatory in your flow, ensure it's provided
  // you may default to user's saved address if null (implement as needed)

  // Calculate totals using same helper as createOrder controller
  const {
    items: validatedItems,
    total,
    coupon,
  } = await calculateOrderTotals(items, couponCode, session);

  // Reserve/decrement stock for each variant
  for (const item of validatedItems) {
    await decrementVariantStock(item.variant, item.quantity, session);
  }

  // Reserve coupon usage if applicable
  if (coupon?.couponId) {
    await reserveCouponUsage(coupon.couponId, userId, session);
  }

  // Build order document
  const [order] = await Order.create(
    [
      {
        user: userId,
        items: validatedItems,
        subtotal: validatedItems.reduce(
          (s, it) => s + (it.lineTotal || it.priceAfterDiscount * it.quantity),
          0
        ),
        discountAmount: coupon?.discountAmount || 0,
        total,
        coupon: coupon || null,
        shippingAddress: shippingAddress || {},
        status:
          paymentMethod === "cod"
            ? "pending"
            : paymentMethod === "none"
            ? "pending"
            : "paid",
        paymentMethod,
        walletTransactionId: walletTxId,
        meta,
      },
    ],
    { session }
  );

  // Invalidate caches
  await cacheDelPattern(`orders:${userId}:*`);

  return order;
}
