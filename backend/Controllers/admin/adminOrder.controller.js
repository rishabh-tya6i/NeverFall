import Order from "../../Models/Order.js";
import User from "../../Models/User.js";
import ProductVariant from "../../Models/ProductVariant.js";
import Payment from "../../Models/Payments.js";
import WalletTransaction from "../../Models/WalletTransaction.js";
import mongoose from "mongoose";
import logger from "../../utils/logger.js";

// Utility to process wallet refunds
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

/**
 * Approve a refund for an order
 */
export const approveRefund = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { id } = req.params;
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

    const payments = await Payment.find({
      order: order._id,
      status: { $in: ["success", "cod_pending"] },
    }).session(session);

    for (const payment of payments) {
      if (payment.method === "wallet") {
        await processWalletRefund(
          order.user,
          payment.amount,
          order._id,
          reason,
          session
        );
      } else {
        // For gateway payments, this would trigger a gateway refund.
        // For now, we just mark it as refunded.
        payment.status = "refunded";
        payment.meta.refundReason = reason;
        payment.meta.refundedBy = adminId;
        await payment.save({ session });
      }
    }

    order.status = "refunded";
    order.meta.refund = {
      approvedBy: adminId,
      approvedAt: new Date(),
      reason,
    };

    await order.save({ session });
    await session.commitTransaction();

    logger.info(
      `Refund approved for order ${order._id} by admin ${adminId}`
    );
    res.json({ message: "Refund approved successfully", order });
  } catch (error) {
    await session.abortTransaction();
    logger.error("Failed to approve refund:", error);
    res.status(500).json({ message: "Failed to approve refund" });
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
                count: 1
            }
        }
      ]);

    res.json({
      period,
      analytics: analytics[0] || { totalSales: 0, totalOrders: 0, averageOrderValue: 0 },
      statusDistribution,
    });
  } catch (error) {
    logger.error("Failed to get order analytics:", error);
    res.status(500).json({ message: "Failed to get order analytics" });
  }
};
