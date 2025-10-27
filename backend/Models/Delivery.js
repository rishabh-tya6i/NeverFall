import mongoose from "mongoose";

const deliveryHistorySchema = new mongoose.Schema({
  status: { type: String, required: true },
  at: { type: Date, default: Date.now },
  note: { type: String },
  raw: { type: mongoose.Schema.Types.Mixed },
});

const deliverySchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: [
        "created",
        "manifest_failed",
        "manifested",
        "picked_up",
        "in_transit",
        "out-for-delivery",
        "delivered",
        "cancelled",
        "rto",
        "attempted",
        "pending",
        "not_picked",
        "otp_verified",
        "otp_failed",
      ],
      default: "created",
    },
    pickup_location: { type: String, required: true },
    payment_mode: { type: String, enum: ["COD", "Prepaid"], required: true },
    attemptCount: { type: Number, default: 0 },
    history: [deliveryHistorySchema],
    meta: {
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      failedOtpCount: { type: Number, default: 0 },
      delhiveryError: { type: mongoose.Schema.Types.Mixed },
      cancelResp: { type: mongoose.Schema.Types.Mixed },
    },
    delhiveryRaw: { type: mongoose.Schema.Types.Mixed },
    waybill: { type: String, index: true },
    otpHash: { type: String },
    otpSentAt: { type: Date },
    otpVerified: { type: Boolean, default: false },
    otpMeta: {
      sentVia: { type: String },
      sentTo: { type: String },
    },
    deliveredAt: { type: Date },
  },
  { timestamps: true }
);

const Delivery = mongoose.model("Delivery", deliverySchema);

export default Delivery;