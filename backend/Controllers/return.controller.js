import mongoose from "mongoose";
import Order from "../Models/Order.js";
import ReturnRequest from "../Models/ReturnRequest.js";
import Delivery from "../Models/Delivery.js";
import Payment from "../Models/Payments.js";
import User from "../Models/User.js";
import ProductVariant from "../Models/ProductVariant.js";
import WalletTransaction from "../Models/WalletTransaction.js";
// import { computeFraudScore } from "../Controllers/exchange.controller.js";
import { scheduleCourierPickup } from "../Services/delivery.service.js";
import { getActiveGatewayAdapter } from "../Services/gatewayFactory.js";
import logger from "../utils/logger.js";

const RETURN_WINDOW_DAYS = Number(process.env.RETURN_WINDOW_DAYS || 7);
const AUTO_RESTOCK_ON_APPROVAL =
  process.env.AUTO_RESTOCK_ON_APPROVAL === "true";

function getLineFromOrder(order, index) {
  if (!order || !Array.isArray(order.items)) return null;
  return order.items[index] || null;
}

async function creditUserWallet(userId, amount, orderId, session, meta = {}) {
  if (!amount || amount <= 0) return null;

  const user = await User.findById(userId).session(session);
  if (!user) throw new Error("User not found for wallet credit");

  // Create wallet tx
  const [walletTx] = await WalletTransaction.create(
    [
      {
        user: userId,
        type: "credit",
        amount,
        currency: "INR",
        status: "available",
        source: "refund",
        refId: orderId,
        meta,
      },
    ],
    { session }
  );

  user.wallet = user.wallet || {};
  user.wallet.balance = (user.wallet.balance || 0) + amount;
  await user.save({ session });

  logger.info("Wallet credited", {
    userId,
    amount,
    newBalance: user.wallet.balance,
  });
  return walletTx;
}

export const createReturnRequest = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const userId = req.user._id;
    const {
      orderId,
      orderItemIndex,
      quantity = 1,
      reason = "",
      notes = "",
      photos = [],
    } = req.body;

    if (!orderId || typeof orderItemIndex !== "number") {
      throw new Error("orderId and orderItemIndex are required");
    }

    const order = await Order.findById(orderId).session(session);
    const refundMethod =
      order.paymentMethod === "gateway" && order.walletTransactionId === null
        ? "gateway"
        : "wallet";
    // only allow wallet/gateway for now
    if (!["wallet", "gateway"].includes(refundMethod)) {
      throw new Error("Invalid refund method");
    }

    if (!order) throw new Error("Order not found");
    if (String(order.user) !== String(userId)) throw new Error("Unauthorized");

    const line = getLineFromOrder(order, orderItemIndex);
    if (!line) throw new Error("Order item not found");

    // check delivered status via Delivery model
    const delivery = await Delivery.findOne({
      order: orderId,
      deliveredAt: { $ne: null },
    })
      .sort({ deliveredAt: -1 })
      .session(session);
    if (!delivery || !delivery.deliveredAt)
      throw new Error("Order not delivered");

    // check return window
    const now = new Date();
    const deliveredAt = new Date(delivery.deliveredAt);
    const diffDays = (now - deliveredAt) / (1000 * 60 * 60 * 24);
    if (diffDays > RETURN_WINDOW_DAYS) {
      throw new Error(`Return window of ${RETURN_WINDOW_DAYS} days has passed`);
    }

    // check available quantity to return (supports partial returns)
    const alreadyReturned = Number(line.returnedQuantity || 0);
    const maxReturnable = Number(line.quantity) - alreadyReturned;
    if (maxReturnable <= 0)
      throw new Error("No quantity left to return for this item");
    if (quantity > maxReturnable)
      throw new Error(
        `Quantity to return exceeds available quantity. Max: ${maxReturnable}`
      );

    // fraud score (quick check). If flagged, admin must manually approve later.
    // const fraudResult = await computeFraudScore({
    //   userId,
    //   order,
    //   line,
    //   quantity,
    //   ip: req.ip,
    //   userAgent: req.get("User-Agent"),
    // });

    // Create return request in REQUESTED state (admin must approve to schedule pickup)
    const rr = new ReturnRequest({
      order: orderId,
      orderItemIndex,
      variant: line.variant,
      user: userId,
      quantity,
      delivery: delivery._id,
      reason,
      notes,
      photos,
      requestedAt: now,
      status: "requested",
      refundMethod,
      // fraud: {
      //   score: fraudResult.score,
      //   reason: fraudResult.reason,
      //   flagged: fraudResult.flagged,
      // },
      meta: {
        requestedFromIp: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    await rr.save({ session });

    // flag order (optional)
    order.meta = order.meta || {};
    order.meta.hasReturn = true;
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json(rr);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error("createReturnRequest failed", { error: err.message });
    return res.status(400).json({ message: err.message });
  }
};

export const cancelReturnRequest = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const userId = req.user._id;
    const { id } = req.params; // return request ID

    const rr = await ReturnRequest.findById(id).session(session);
    if (!rr) throw new Error("Return request not found");

    // authorization
    if (String(rr.user) !== String(userId)) {
      throw new Error("Unauthorized to cancel this return request");
    }

    // Only allow cancel if status is 'requested'
    if (rr.status !== "requested") {
      throw new Error(
        "Return request cannot be cancelled once approved or pickup scheduled"
      );
    }

    // update status
    rr.status = "cancelled";
    rr.cancelledAt = new Date();
    rr.meta = rr.meta || {};
    rr.meta.cancelledFromIp = req.ip;
    rr.meta.cancelledByUserAgent = req.get("User-Agent");

    await rr.save({ session });

    // optionally update order meta
    const order = await Order.findById(rr.order).session(session);
    if (order && order.meta?.hasReturn) {
      const stillActiveReturns = await ReturnRequest.find({
        order: rr.order,
        status: { $nin: ["cancelled", "refunded", "rejected"] },
      }).session(session);

      if (stillActiveReturns.length === 0) {
        order.meta.hasReturn = false;
        await order.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Return request cancelled successfully",
      returnRequest: rr,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error("cancelReturnRequest failed", { error: err.message });
    return res.status(400).json({ message: err.message });
  }
};

export const adminApproveReturn = async (req, res) => {
  // admin middleware should ensure req.user.isAdmin
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const returnId = req.params.id;
    const { preferredCarrier = null, scheduleImmediately = true } = req.body;
    const adminId = req.user._id;

    const rr = await ReturnRequest.findById(returnId).session(session);
    if (!rr) throw new Error("Return request not found");

    if (rr.status !== "requested")
      throw new Error("Return request not in requested state");

    // set approved
    rr.status = "approved";
    rr.admin = rr.admin || {};
    rr.admin.processedBy = adminId;
    rr.admin.processedAt = new Date();
    await rr.save({ session });

    // schedule pickup (if requested)
    if (scheduleImmediately) {
      // Note: scheduleCourierPickup should be implemented per-carrier.
      // It may be async external call (not part of txn). We'll call it and then save pickup details.
      try {
        const order = await Order.findById(rr.order).session(session); // for address/details
        // Call external service (may be network). It's OK to call within txn but the external call is outside DB.
        const pickup = await scheduleCourierPickup({
          order,
          returnRequest: rr,
          preferredCarrier,
        });

        rr.pickup = {
          carrier: pickup.carrier,
          scheduledAt: pickup.scheduledAt,
          labelUrl: pickup.labelUrl,
          trackingId: pickup.trackingId,
        };
        rr.status = "pickup_scheduled";
        await rr.save({ session });
      } catch (carrierErr) {
        // Carrier scheduling failed — keep rr as approved but not scheduled.
        logger.warn("Carrier scheduling failed", {
          returnId,
          err: carrierErr?.message,
        });
        // Do not throw — admin can retry scheduling later.
      }
    }

    await session.commitTransaction();
    session.endSession();

    return res.json(rr);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error("adminApproveReturn failed", { error: err.message });
    return res.status(400).json({ message: err.message });
  }
};

export const adminReceiveAndProcessRefund = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const returnId = req.params.id;
    const {
      condition = "new",
      adminNotes = "",
      restockingFee = 0,
      overrideRefundAmount = null,
      restockToInventory = AUTO_RESTOCK_ON_APPROVAL,
    } = req.body;
    const adminId = req.user._id;

    const rr = await ReturnRequest.findById(returnId).session(session);
    if (!rr) throw new Error("Return request not found");

    if (
      !["pickup_scheduled", "picked_up", "approved"].includes(rr.status) &&
      rr.status !== "requested"
    ) {
      throw new Error("Return request not in receivable state");
    }

    // idempotency: if already refunded, return current rr
    if (rr.status === "refunded" || rr.refund?.refundedAt) {
      await session.commitTransaction();
      session.endSession();
      return res.json(rr);
    }

    // mark as received / inspected
    rr.status = "received";
    rr.condition = condition;
    rr.admin = rr.admin || {};
    rr.admin.processedBy = adminId;
    rr.admin.processedAt = new Date();
    rr.admin.adminNotes = adminNotes;
    await rr.save({ session });

    // fetch order and line
    const order = await Order.findById(rr.order).session(session);
    if (!order) throw new Error("Related order not found");

    const line = getLineFromOrder(order, rr.orderItemIndex);
    if (!line) throw new Error("Order line not found");

    // check cumulative quantity invariants
    const alreadyReturned = Number(line.returnedQuantity || 0);
    if (alreadyReturned + rr.quantity > line.quantity) {
      throw new Error("Approving this return would exceed purchased quantity");
    }

    // === Compute per-unit effective price AFTER discount ===
    // Prefer line.priceAfterDiscount per-line if available (it is the line total after discounts).
    // Calculate effective per-unit amount = (line.priceAfterDiscount || line.lineTotal) / line.quantity
    const lineTotalAfterDiscount = Number(
      line.priceAfterDiscount != null ? line.priceAfterDiscount : line.lineTotal
    );
    const perUnitEffective = lineTotalAfterDiscount / Number(line.quantity);

    // gross refund for returned qty based on effective per-unit price
    const grossRefund = perUnitEffective * rr.quantity;

    // === PRO-RATE COUPON DEDUCTION (defensive, but should be small since priceAfterDiscount already applied) ===
    let couponDeduction = 0;
    try {
      const orderDiscount = Number(order.discountAmount || 0);
      const orderSubtotal = Number(order.subtotal || 0);

      if (orderDiscount > 0 && orderSubtotal > 0) {
        // compute how much discount was allocated to this line in the original order
        const lineTotalBeforeDiscount = Number(
          line.lineTotal != null ? line.lineTotal : line.price * line.quantity
        );
        const lineShareOfSubtotal = lineTotalBeforeDiscount / orderSubtotal;
        const couponAllocatedToLine = orderDiscount * lineShareOfSubtotal;

        // coupon allocated for the returned qty (pro-rate by qty)
        const couponForReturnedQty =
          (couponAllocatedToLine * rr.quantity) / Number(line.quantity);

        couponDeduction = Number(couponForReturnedQty.toFixed(2));
      }
    } catch (e) {
      logger.warn("coupon allocation failed for return", {
        returnId,
        err: e.message,
      });
      couponDeduction = 0;
    }

    // compute final refund after coupon and restocking, ensure non-negative and round to 2 decimals
    let computedRefund = Math.max(
      0,
      grossRefund - couponDeduction - (restockingFee || 0)
    );
    const finalRefund =
      overrideRefundAmount !== null
        ? Number(overrideRefundAmount)
        : Number(computedRefund.toFixed(2));

    // update rr refund metadata
    rr.refund = rr.refund || {};
    rr.refund.amount = finalRefund;
    rr.refund.currency = "INR";
    rr.restockingFee = restockingFee;
    rr.admin.processedBy = adminId;
    rr.admin.processedAt = new Date();
    await rr.save({ session });

    // === Determine payment composition (existing payments for the order) ===
    const payments = await Payment.find({
      order: order._id,
      status: "success",
    }).session(session);

    const walletPayments = payments.filter(
      (p) =>
        p.method === "wallet" ||
        (p.walletTransactionId && String(p.walletTransactionId).length > 0)
    );
    const walletPaid = walletPayments.reduce(
      (s, p) => s + Number(p.amount || 0),
      0
    );

    const codPayments = payments.filter((p) => p.method === "cod");
    const codPaid = codPayments.reduce((s, p) => s + Number(p.amount || 0), 0);

    const gatewayPayments = payments.filter(
      (p) =>
        p.method !== "wallet" &&
        p.method !== "cod" &&
        !(p.walletTransactionId && String(p.walletTransactionId).length > 0)
    );
    const gatewayPaidTotal = gatewayPayments.reduce(
      (s, p) => s + Number(p.amount || 0),
      0
    );

    // Persist planned routing for audit (single-platform attempt)
    const isGatewayOnly =
      gatewayPaidTotal > 0 && walletPaid === 0 && codPaid === 0;

    rr.refundRouting = rr.refundRouting || {};
    rr.refundRouting.planned = isGatewayOnly ? "gateway" : "wallet";
    rr.refundRouting.actual = rr.refundRouting.actual || null;
    await rr.save({ session });

    // prepare refund results
    const refundResults = {
      walletCredit: 0,
      gatewayRefund: null,
      fallbackToWallet: false,
    };

    if (finalRefund > 0) {
      // If gateway-only planned: attempt to refund up to what was paid via gateway.
      if (isGatewayOnly) {
        try {
          // choose the latest gateway payment that has gatewayPaymentId
          const origPayment = gatewayPayments
            .filter((p) => p.gatewayPaymentId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

          if (!origPayment || !origPayment.gatewayPaymentId) {
            // No gateway payment id => fallback to wallet
            refundResults.fallbackToWallet = true;
            logger.warn(
              "No original gateway payment id found, falling back to wallet",
              {
                returnId: rr._id,
              }
            );
          } else {
            // Cap gateway refund to the amount actually paid by gateway
            const gatewayCap = Math.min(finalRefund, gatewayPaidTotal);

            // If gatewayCap is zero, fallback to wallet
            if (gatewayCap <= 0) {
              refundResults.fallbackToWallet = true;
            } else {
              const adapter = await getActiveGatewayAdapter();
              const refundResp = await adapter.createRefund({
                gatewayPaymentId: origPayment.gatewayPaymentId,
                amount: gatewayCap,
                currency: "INR",
                reason: `Refund for return ${rr._id}`,
                metadata: {
                  orderId: order._id.toString(),
                  returnRequestId: rr._id.toString(),
                },
              });

              if (!refundResp || !refundResp.success) {
                logger.warn("Gateway refund failed or returned no success", {
                  refundResp,
                  returnId: rr._id,
                });
                refundResults.fallbackToWallet = true;
              } else {
                rr.refund.gatewayRefundId =
                  refundResp.refundId || refundResp.id || null;
                rr.refund.refundedAt = new Date();
                refundResults.gatewayRefund = {
                  refundId: rr.refund.gatewayRefundId,
                  amount: gatewayCap,
                };
                rr.refundRouting.actual = "gateway";
                await rr.save({ session });

                // If gatewayCap < finalRefund, credit the remainder to wallet
                const remainder = Number((finalRefund - gatewayCap).toFixed(2));
                if (remainder > 0) {
                  const walletTx = await creditUserWallet(
                    order.user,
                    remainder,
                    order._id,
                    session,
                    {
                      reason: `Refund remainder to wallet for return ${rr._id}`,
                      originalRouting: "gateway-partial",
                    }
                  );
                  refundResults.walletCredit = remainder;
                  rr.refund.refundTx = walletTx
                    ? walletTx._id
                    : rr.refund.refundTx || null;
                  rr.refund.refundedAt = rr.refund.refundedAt || new Date();
                  rr.refundRouting.actual = "gateway+wallet";
                  await rr.save({ session });
                }
              }
            }
          }
        } catch (gatewayErr) {
          logger.warn("Gateway refund attempt error, will fallback to wallet", {
            err: gatewayErr.message,
            returnId: rr._id,
          });
          refundResults.fallbackToWallet = true;
        }
      }

      // If not gateway-only OR gateway failed/fallback => credit wallet (either full or remainder)
      if (!isGatewayOnly || refundResults.fallbackToWallet) {
        const walletAmountToCredit = !isGatewayOnly
          ? finalRefund
          : refundResults.fallbackToWallet
          ? finalRefund
          : 0;

        if (walletAmountToCredit > 0) {
          const walletTx = await creditUserWallet(
            order.user,
            walletAmountToCredit,
            order._id,
            session,
            {
              reason: `Refund (wallet) for return ${rr._id}`,
              originalRouting: isGatewayOnly
                ? "gateway-fallback"
                : "wallet-or-mixed",
            }
          );
          refundResults.walletCredit = walletAmountToCredit;
          rr.refund.refundTx = walletTx
            ? walletTx._id
            : rr.refund.refundTx || null;
          rr.refund.refundedAt = new Date();
          rr.refundRouting.actual = "wallet";
          await rr.save({ session });
        }
      }
    }

    // Update order returnedQuantity and optionally restock inventory
    line.returnedQuantity = (line.returnedQuantity || 0) + rr.quantity;
    await order.save({ session });

    if (restockToInventory) {
      await ProductVariant.updateOne(
        { _id: rr.variant },
        { $inc: { stock: rr.quantity } },
        { session }
      );
    }

    // Finalize rr state
    rr.status = "refunded";
    rr.meta = rr.meta || {};
    rr.meta.refundResults = refundResults;
    if (!rr.refund.refundedAt) rr.refund.refundedAt = new Date();
    await rr.save({ session });

    await session.commitTransaction();
    session.endSession();

    logger.info("Return received and refund processed (single-platform rule)", {
      returnId: rr._id,
      refundResults,
    });
    return res.json(rr);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error("adminReceiveAndProcessRefund failed", { error: err.message });
    return res.status(400).json({ message: err.message });
  }
};

export const listReturnsForUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;
    const returns = await ReturnRequest.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("order variant delivery");
    res.json(returns);
  } catch (err) {
    logger.error("listReturnsForUser failed", { error: err.message });
    res.status(400).json({ message: err.message });
  }
};

export const getReturn = async (req, res) => {
  try {
    const id = req.params.id;
    const rr = await ReturnRequest.findById(id).populate(
      "order variant delivery"
    );
    if (!rr) return res.status(404).json({ message: "Not found" });

    if (!req.user.isAdmin && String(rr.user) !== String(req.user._id)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(rr);
  } catch (err) {
    logger.error("getReturn failed", { error: err.message });
    res.status(400).json({ message: err.message });
  }
};

export default {
  createReturnRequest,
  adminApproveReturn,
  adminReceiveAndProcessRefund,
  listReturnsForUser,
  getReturn,
};
