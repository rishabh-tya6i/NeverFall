import mongoose from "mongoose";

const ReturnRequestSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    orderItemIndex: { type: Number, required: true }, // line index in order.items
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // quantity being returned (supports partial)
    quantity: { type: Number, required: true, min: 1 },

    delivery: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Delivery",
      default: null,
    },

    reason: { type: String, default: "" },
    notes: { type: String, default: "" },
    photos: [{ type: String }], // s3 urls

    requestedAt: { type: Date, default: Date.now },

    status: {
      type: String,
      enum: [
        "requested",
        "pickup_scheduled",
        "picked_up",
        "received",
        "inspected",
        "approved",
        "rejected",
        "refunded",
        "closed",
      ],
      default: "requested",
      index: true,
    },

    // refund: method tells where refund should go: 'wallet'|'gateway'
    refundMethod: {
      type: String,
      enum: ["wallet", "gateway"],
      default: "wallet",
    },
    refund: {
      amount: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
      refundedAt: { type: Date, default: null },
      refundTx: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "WalletTransaction",
        default: null,
      },
      gatewayRefundId: { type: String, default: null },
    },

    restockingFee: { type: Number, default: 0 },

    // pickup / carrier info
    pickup: {
      carrier: { type: String, default: null },
      scheduledAt: { type: Date, default: null },
      pickupSlot: { type: Object, default: null },
      labelUrl: { type: String, default: null },
      trackingId: { type: String, default: null },
    },

    // fraud scoring
    fraud: {
      score: { type: Number, default: 0 }, // 0-100
      reason: { type: String, default: "" },
      flagged: { type: Boolean, default: false },
    },

    condition: {
      type: String,
      enum: ["new", "opened", "damaged", "missing_parts", "other"],
      default: "new",
    },

    admin: {
      processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      processedAt: Date,
      adminNotes: String,
    },

    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

// prevent exact duplicate returns that would exceed qty: compound index
ReturnRequestSchema.index({ order: 1, orderItemIndex: 1, _id: 1 });

export default mongoose.models.ReturnRequest ||
  mongoose.model("ReturnRequest", ReturnRequestSchema);
