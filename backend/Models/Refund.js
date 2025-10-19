import mongoose from "mongoose";

const RefundSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: false,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    method: {
      type: String,
      enum: ["wallet", "gateway", "manual"],
      required: true,
    },
    gatewayName: {
      type: String,
      default: null, // e.g. "razorpay", "cashfree", "payu"
    },
    status: {
      type: String,
      enum: ["pending", "processing", "success", "failed"],
      default: "pending",
    },
    reason: {
      type: String,
      default: "Not specified",
    },
    gatewayRefundId: {
      type: String,
      default: null,
    },
    transactionId: {
      type: String,
      default: null, // For wallet/manual refunds
    },
    gatewayResponse: {
      type: Object,
      default: {},
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // admin who processed refund
    },
  },
  { timestamps: true }
);

export default mongoose.model("Refund", RefundSchema);
