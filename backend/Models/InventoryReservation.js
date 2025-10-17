// models/InventoryReservation.js
import mongoose from "mongoose";

const InventoryReservationSchema = new mongoose.Schema(
  {
    skuId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
      index: true,
    },
    reservedBy: {
      type: String,
      enum: ["exchange", "checkout"],
      required: true,
    },
    reservedForId: { type: mongoose.Schema.Types.ObjectId, required: true }, // exchangeRequestId or orderId
    quantity: { type: Number, default: 1 },
    reservedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

InventoryReservationSchema.index({ skuId: 1, reservedForId: 1 });

export default mongoose.model(
  "InventoryReservation",
  InventoryReservationSchema
);
