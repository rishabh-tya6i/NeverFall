import Order from "../../Models/Order.js";
import User from "../../Models/User.js";
import Refund from "../../Models/Refund.js";
import ProductVariant from "../../Models/ProductVariant.js";
import Payment from "../../Models/Payments.js";
import WalletTransaction from "../../Models/WalletTransaction.js";
import mongoose from "mongoose";
import logger from "../../utils/logger.js";
import { getActiveGatewayAdapter } from "../../Services/gatewayFactory.js"; // add this import at top if not present

// Utility to process wallet refunds
//good
async function processWalletRefund(userId, amount, orderId, reason, session) {
  const user = await User.findById(userId).session(session);
  if (!user) {
    throw new Error("User not found for refund");
  }

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

  user.wallet.balance = (user.wallet.balance || 0) + amount;
  await user.save({ session });

  return walletTx[0];
}

/**
 * Get all orders with filtering and pagination
 */
export const getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      userId,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (userId) query.user = userId;

    const sortOptions = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const orders = await Order.find(query)
      .populate("user", "name email")
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error("Failed to get all orders:", error);
    res.status(500).json({ message: "Failed to retrieve orders" });
  }
};

/**
 * Update the status of an order
 */
export const updateOrderStatus = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.user.id;

    const validStatuses = [
      "pending",
      "paid",
      "processing",
      "confirmed",
      "out-for-delivery",
      "delivered",
      "cancelled",
      "refunded",
      "failed",
      "return-requested",
      "returned",
      "exchange-requested",
      "exchange-approved",
      "pickup-scheduled",
      "picked-up",
      "exchanged",
      "exchange-rejected",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid order status" });
    }

    const order = await Order.findById(id).session(session);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const oldStatus = order.status;
    order.status = status;

    // Log the status change
    order.meta.statusHistory = order.meta.statusHistory || [];
    order.meta.statusHistory.push({
      status,
      updatedAt: new Date(),
      updatedBy: adminId,
    });

    await order.save({ session });
    await session.commitTransaction();

    logger.info(
      `Order ${order._id} status updated from ${oldStatus} to ${status} by admin ${adminId}`
    );
    res.json(order);
  } catch (error) {
    await session.abortTransaction();
    logger.error("Failed to update order status:", error);
    res.status(500).json({ message: "Failed to update order status" });
  } finally {
    session.endSession();
  }
};

export const approveRefund = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const { id } = req.params; // order id
      const { reason = "Admin approved refund" } = req.body;
      const adminId = req.user.id;

      const order = await Order.findById(id).session(session);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (!["cancelled", "returned"].includes(order.status)) {
        return res
          .status(400)
          .json({ message: "Order is not in a refundable state" });
      }

      // fetch successful payments for this order
      const payments = await Payment.find({
        order: order._id,
        status: { $in: ["success"] },
      }).session(session);

      // try to get an adapter (may be null if only wallet/manual refunds)
      let adapter = null;
      try {
        adapter = await getActiveGatewayAdapter();
      } catch (e) {
        // adapter may not be available — gateway refunds will fail gracefully below
        adapter = null;
      }

      const refundResults = [];

      for (const payment of payments) {
        // create simple Refund doc
        const refundDoc = await Refund.create(
          [
            {
              orderId: order._id,
              paymentId: payment._id,
              userId: order.user,
              amount: payment.amount,
              method:
                payment.method === "wallet" ||
                payment.meta?.walletTransactionId ||
                order.walletTransactionId
                  ? "wallet"
                  : payment.gatewayPaymentId
                  ? "gateway"
                  : "manual",
              gatewayName:
                payment.gatewayName ||
                payment.gateway ||
                (adapter && adapter.name) ||
                null,
              reason,
              status: "pending",
              processedBy: adminId,
            },
          ],
          { session }
        );

        const refund = refundDoc[0];

        try {
          // WALLET path
          if (refund.method === "wallet") {
            const walletTx = await processWalletRefund(
              order.user,
              refund.amount,
              order._id,
              reason,
              session
            );

            // update refund doc
            refund.status = "success";
            refund.transactionId =
              walletTx._id?.toString?.() || String(walletTx._id);
            await refund.save({ session });

            // update payment
            payment.status = "refunded";
            payment.meta = payment.meta || {};
            payment.meta.refund = {
              refundId: refund._id,
              method: "wallet",
              walletTxId: walletTx._id,
            };
            await payment.save({ session });

            refundResults.push({
              paymentId: payment._id,
              refundId: refund._id,
              method: "wallet",
              amount: refund.amount,
              status: "success",
            });

            continue;
          }

          // GATEWAY path
          if (refund.method === "gateway" && payment.gatewayPaymentId) {
            if (!adapter || typeof adapter.refund !== "function") {
              throw new Error("Gateway adapter not available for refund");
            }

            const resp = await adapter.refund({
              gatewayPaymentId: payment.gatewayPaymentId,
              amount: refund.amount,
              currency: payment.currency || "INR",
              reason,
            });

            // simple success detection
            const success =
              resp &&
              (resp.success === true ||
                resp.refund_id ||
                resp.id ||
                resp.status === "processed");

            refund.gatewayResponse = resp || {};
            if (resp?.refund_id) refund.gatewayRefundId = resp.refund_id;
            if (resp?.id)
              refund.gatewayRefundId = refund.gatewayRefundId || resp.id;

            refund.status = success ? "success" : "failed";
            await refund.save({ session });

            // update payment
            payment.status = success ? "refunded" : payment.status;
            payment.meta = payment.meta || {};
            payment.meta.refund = {
              refundId: refund._id,
              method: "gateway",
              gatewayResponse: resp,
            };
            await payment.save({ session });

            refundResults.push({
              paymentId: payment._id,
              refundId: refund._id,
              method: "gateway",
              amount: refund.amount,
              status: refund.status,
              gatewayResponse: resp,
            });

            continue;
          }

          // MANUAL or unknown path — mark refund as failed/pending manual follow-up
          refund.status = "failed";
          refund.gatewayResponse = {
            note: "No refund automated path available",
          };
          await refund.save({ session });

          payment.meta = payment.meta || {};
          payment.meta.refund = {
            refundId: refund._id,
            method: refund.method,
            note: "Manual follow-up required",
          };
          await payment.save({ session });

          refundResults.push({
            paymentId: payment._id,
            refundId: refund._id,
            method: refund.method,
            amount: refund.amount,
            status: "manual_required",
          });
        } catch (innerErr) {
          // mark refund as failed and continue
          logger.error("Refund attempt error", {
            paymentId: payment._id,
            error: innerErr.message,
          });

          try {
            refund.status = "failed";
            refund.gatewayResponse = refund.gatewayResponse || {};
            refund.gatewayResponse.error = innerErr.message;
            await refund.save({ session });
          } catch (saveErr) {
            logger.error("Failed to save refund failure", {
              err: saveErr.message,
            });
          }

          payment.meta = payment.meta || {};
          payment.meta.refund = payment.meta.refund || {};
          payment.meta.refund.error = innerErr.message;
          await payment.save({ session });

          refundResults.push({
            paymentId: payment._id,
            refundId: refund._id,
            method: refund.method,
            amount: refund.amount,
            status: "error",
            error: innerErr.message,
          });
        }
      } // end for payments

      // update order status + meta
      order.status = "refunded";
      order.meta = order.meta || {};
      order.meta.refund = {
        approvedBy: adminId,
        approvedAt: new Date(),
        reason,
        refundResults,
      };
      await order.save({ session });

      logger.info(
        `Refund approved for order ${order._id} by admin ${adminId}`,
        {
          refundResults,
        }
      );

      res.json({
        message: "Refund approved (attempted) successfully",
        order,
        refundResults,
      });
    }); // end transaction
  } catch (error) {
    logger.error("Failed to approve refund:", error);
    return res
      .status(500)
      .json({ message: "Failed to approve refund", error: error.message });
  } finally {
    session.endSession();
  }
};

/**
 * Get order analytics
 */
export const getOrderAnalytics = async (req, res) => {
  try {
    const { period = "30d" } = req.query;
    let startDate;

    switch (period) {
      case "24h":
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const analytics = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $nin: ["failed", "cancelled", "pending"] },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$total" },
          totalOrders: { $sum: 1 },
          averageOrderValue: { $avg: "$total" },
        },
      },
      {
        $project: {
          _id: 0,
          totalSales: 1,
          totalOrders: 1,
          averageOrderValue: 1,
        },
      },
    ]);

    const statusDistribution = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          status: "$_id",
          count: 1,
        },
      },
    ]);

    res.json({
      period,
      analytics: analytics[0] || {
        totalSales: 0,
        totalOrders: 0,
        averageOrderValue: 0,
      },
      statusDistribution,
    });
  } catch (error) {
    logger.error("Failed to get order analytics:", error);
    res.status(500).json({ message: "Failed to get order analytics" });
  }
};
