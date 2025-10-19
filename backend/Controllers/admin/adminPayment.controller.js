import Payment from "../../Models/Payments.js";
import Order from "../../Models/Order.js";
import User from "../../Models/User.js";
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
 * Get all payments with filtering and pagination
 */
export const getAllPayments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      userId,
      orderId,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (userId) query.user = userId;
    if (orderId) query.order = orderId;

    const sortOptions = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const payments = await Payment.find(query)
      .populate("user", "name email")
      .populate("order", "status total")
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Payment.countDocuments(query);

    res.json({
      payments,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error("Failed to get all payments:", error);
    res.status(500).json({ message: "Failed to retrieve payments" });
  }
};

/**
 * Process a manual refund for a specific payment
 */
//No usage use from adminOrder.controller
// export const processManualRefund = async (req, res) => {
//   const session = await mongoose.startSession();
//   try {
//     session.startTransaction();
//     const { paymentId } = req.params;
//     const { reason = "Manual refund by admin" } = req.body;
//     const adminId = req.user.id;

//     const payment = await Payment.findById(paymentId).session(session);
//     if (!payment) {
//       return res.status(404).json({ message: "Payment not found" });
//     }

//     if (payment.status !== "success") {
//       return res
//         .status(400)
//         .json({ message: "Only successful payments can be refunded" });
//     }

//     const order = await Order.findById(payment.order).session(session);
//     if (!order) {
//       return res.status(404).json({ message: "Associated order not found" });
//     }

//     if (payment.method === "wallet") {
//       await processWalletRefund(
//         payment.user,
//         payment.amount,
//         payment.order,
//         reason,
//         session
//       );
//     } else {
//       // For gateway payments, this would trigger a gateway refund.
//       // For now, we just mark it as refunded.
//       payment.status = "refunded";
//       payment.meta.refundReason = reason;
//       payment.meta.refundedBy = adminId;
//       await payment.save({ session });
//     }

//     // Update order status to 'refunded' if all payments are refunded
//     const allPaymentsForOrder = await Payment.find({ order: order._id }).session(
//       session
//     );
//     const allRefunded = allPaymentsForOrder.every(
//       (p) => p.status === "refunded"
//     );

//     if (allRefunded) {
//       order.status = "refunded";
//       order.meta.refund = {
//         approvedBy: adminId,
//         approvedAt: new Date(),
//         reason,
//       };
//       await order.save({ session });
//     }

//     await session.commitTransaction();

//     logger.info(
//       `Manual refund processed for payment ${payment._id} by admin ${adminId}`
//     );
//     res.json({ message: "Refund processed successfully", payment });
//   } catch (error) {
//     await session.abortTransaction();
//     logger.error("Failed to process manual refund:", error);
//     res.status(500).json({ message: "Failed to process manual refund" });
//   } finally {
//     session.endSession();
//   }
// };

/**
 * Get payment analytics
 */
export const getPaymentAnalytics = async (req, res) => {
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

    const analytics = await Payment.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          totalVolume: { $sum: "$amount" },
          totalTransactions: { $sum: 1 },
          successfulTransactions: {
            $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
          },
          failedTransactions: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
        },
      },
    ]);

    const statusDistribution = await Payment.aggregate([
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
        totalVolume: 0,
        totalTransactions: 0,
        successfulTransactions: 0,
        failedTransactions: 0,
      },
      statusDistribution,
    });
  } catch (error) {
    logger.error("Failed to get payment analytics:", error);
    res.status(500).json({ message: "Failed to get payment analytics" });
  }
};
