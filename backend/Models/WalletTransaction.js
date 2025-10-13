// models/WalletTransaction.js
import mongoose from "mongoose";
const WalletTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: { type: String, enum: ["credit", "debit"], required: true }, // credit => to wallet, debit => from wallet for payment
    amount: { type: Number, required: true }, // positive
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["pending", "available", "rejected"],
      default: "available",
    },
    source: { type: String, default: "order" }, // e.g., 'order','exchange','refund','admin'
    refId: { type: mongoose.Schema.Types.ObjectId, default: null }, // order/payment/exchange ref
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model("WalletTransaction", WalletTransactionSchema);
