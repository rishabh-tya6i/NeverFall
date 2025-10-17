import mongoose from "mongoose";

const OrderItemSchema = new mongoose.Schema(
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
    title: { type: String, required: true },
    color: { type: String },
    size: { type: String },
    price: { type: Number, required: true },
    priceAfterDiscount: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    returnedQuantity: { type: Number, default: 0 },
    lineTotal: { type: Number, required: true },
  },
  { _id: false }
);

const PaymentDetailSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ["cod", "wallet", "razorpay", "payu"],
      required: true,
    },
    amount: { type: Number, required: true },
    gatewayPaymentId: { type: String, default: null },
    status: {
      type: String,
      enum: ["created", "success", "failed", "cod_pending"],
      default: "created",
    },
    meta: { type: Object, default: {} },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: { type: [OrderItemSchema], default: [] },
    subtotal: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    coupon: {
      couponId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Coupon",
        default: null,
      },
      code: { type: String, default: "" },
      targetUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true,
      },
    },
    status: {
      type: String,
      enum: [
        "pending",
        "paid",
        "processing",
        "confirmed",
        "out-for-delivery",
        "delivered",
        "cancelled",
        "refunded",
        "failed",
        "return-requested",
        "returned",
        "exchange-requested",
        "exchange-approved",
        "pickup-scheduled",
        "picked-up",
        "exchanged",
        "exchange-rejected",
      ],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["cod", "wallet", "razorpay", "payu", "none"],
      default: "none",
    },
    
    walletTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WalletTransaction",
      default: null,
    },
    payments: { type: [PaymentDetailSchema], default: [] },
    shippingAddress: { type: Object, default: {} },
    deliveryDetails: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Delivery",
      default: null,
    },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

OrderSchema.index({ user: 1, status: 1 });
export default mongoose.model("Order", OrderSchema);
