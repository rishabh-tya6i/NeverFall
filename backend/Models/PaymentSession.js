import mongoose from "mongoose";

const PaymentSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    walletAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ["razorpay", "payu", "cod"],
      required: true,
    },
    gatewayOrderId: {
      type: String,
      sparse: true,
    },
    status: {
      type: String,
      enum: ["active", "completed", "failed", "expired"],
      default: "active",
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: { expireAfterSeconds: 300 }, // 5 minutes TTL
    },
    completedAt: { type: Date },
    meta: {
      userAgent: String,
      ip: String,
      gatewayResponse: Object,
      couponUsageRecordId: mongoose.Schema.Types.ObjectId,
      failureReason: String,
    },
  },
  { timestamps: true }
);

// Prevent multiple active sessions for same order
PaymentSessionSchema.index({ order: 1, status: "active" }, { unique: true });

export default mongoose.model("PaymentSession", PaymentSessionSchema);
