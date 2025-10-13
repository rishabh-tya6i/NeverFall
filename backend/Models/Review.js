import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParentProduct",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    rating: { type: Number, min: 1, max: 5, required: true, index: true },
    body: { type: String, trim: true, default: "" },
    images: [{ url: String }],
  },
  { timestamps: true }
);
ReviewSchema.index({ product: 1, user: 1 }, { unique: true });
export default mongoose.model("Review", ReviewSchema);
