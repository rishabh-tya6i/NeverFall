import mongoose from "mongoose";

const SelectedReplacementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
    },
    sku: { type: String, default: "" },
    priceAtSelection: { type: Number, required: true },
    selectionType: {
      type: String,
      enum: ["auto_place", "user_place"],
      default: "user_place",
    },
  },
  { _id: false }
);

const ExchangeHistorySchema = new mongoose.Schema(
  {
    status: String,
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    at: { type: Date, default: Date.now },
    meta: { type: Object, default: {} },
  },
  { _id: false }
);

const ExchangeRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    originalOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    originalOrderItemIndex: { type: Number, required: true }, // index in Order.items array to identify which item
    requestedAt: { type: Date, default: Date.now },
    estimatedCredit: { type: Number, required: true }, // original paid price - fees (est)
    fees: {
      reversePickup: { type: Number, default: 0 },
      restocking: { type: Number, default: 0 },
    },
    selectedReplacement: { type: SelectedReplacementSchema, default: null },
    status: {
      type: String,
      enum: [
        "REQUESTED",
        "PICKUP_SCHEDULED",
        "PICKED_UP",
        "IN_WAREHOUSE",
        "QC_PENDING",
        "QC_PASSED",
        "QC_FAILED",
        "CREDITED",
        "NEW_ORDER_PLACED",
        "EXCHANGE_COMPLETED",
        "CLOSED",
        "REJECTED",
      ],
      default: "REQUESTED",
    },
    pickupWindow: { from: Date, to: Date },
    qcReport: {
      passed: Boolean,
      notes: String,
      images: [String],
      meta: { type: Object, default: {} },
    },
    linkedNewOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    walletTxId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WalletTransaction",
      default: null,
    },
    payments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Payment" }], // payments used to pay differences
    history: { type: [ExchangeHistorySchema], default: [] },
    idempotencyKey: { type: String, index: true, default: null },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

ExchangeRequestSchema.index({ user: 1, originalOrder: 1 });

export default mongoose.model("ExchangeRequest", ExchangeRequestSchema);
