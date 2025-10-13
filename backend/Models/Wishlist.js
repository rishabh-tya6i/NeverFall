// models/WishlistItem.js
import mongoose from "mongoose";
const WishlistItemSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    }, // color-product
    addedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

WishlistItemSchema.index({ user: 1, product: 1 }, { unique: true });
export default mongoose.model("WishlistItem", WishlistItemSchema);
