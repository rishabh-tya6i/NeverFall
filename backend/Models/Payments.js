// models/Payment.js
import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // method: instrument used for this payment chunk
    method: {
      type: String,
      enum: ["cod", "wallet", "razorpay", "payu"],
      required: true,
    },
    walletTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WalletTransaction",
      default: null,
    },

    // amount debited/charged for this payment doc (positive)
    amount: { type: Number, required: true },

    currency: { type: String, default: "INR" },

    // gateway id for online payments (null for wallet/cod)
    gatewayPaymentId: { type: String, default: null },

    // payment lifecycle for this chunk
    status: {
      type: String,
      enum: [
        "created", // created but not attempted (gateway not started)
        "attempted", // gateway payment attempted
        "success", // succeeded
        "failed", // failed
        "cod_pending", // COD waiting to be collected
        "refunded", // refunded
      ],
      default: "created",
    },

    // optional metadata (gateway response, wallet tx id, etc)
    meta: { type: Object, default: {} },

    // idempotency key to avoid double charging for gateway flows
    idempotencyKey: { type: String, index: true, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Payment", PaymentSchema);
