// models/Delivery.js
import mongoose from "mongoose";

const DeliveryHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    note: { type: String, default: "" },
    raw: { type: Object, default: {} }, // raw payload from Delhivery scan/doc push
  },
  { _id: false }
);

const DeliverySchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: [
        "created",
        "manifest_failed",
        "manifested",
        "processing",
        "out-for-delivery",
        "picked_up",
        "attempted",
        "delivered",
        "rto",
        "cancelled",
      ],
      default: "created",
      index: true,
    },

    // Waybill assigned by Delhivery
    waybill: { type: String, default: null, index: true },
    payment_mode: {
      type: String,
      enum: ["COD", "Prepaid"],
      default: "Prepaid",
    },
    pickup_location: { type: String, default: null },

    delhiveryRaw: { type: Object, default: {} }, // store entire Delhivery response/manifest
    history: { type: [DeliveryHistorySchema], default: [] },

    // OTP for delivery verification
    otpHash: { type: String, default: null },
    otpSentAt: { type: Date, default: null },
    otpVerified: { type: Boolean, default: false },

    deliveredAt: { type: Date, default: null },
    attemptCount: { type: Number, default: 0 }, // NDR attempts / failed delivery attempts

    // optional RTO / NDR fields
    ndrStatus: { type: String, default: null },
    meta: { type: Object, default: {} }, // store admin notes, QC info, manifest info, etc.
  },
  { timestamps: true }
);

DeliverySchema.index({ order: 1, client: 1 });
DeliverySchema.index({ status: 1, waybill: 1 });

export default mongoose.models.Delivery ||
  mongoose.model("Delivery", DeliverySchema);
