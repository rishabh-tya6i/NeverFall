// models/ProductVariant.js
import mongoose from "mongoose";

const ProductVariantSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    size: { type: String, required: true, uppercase: true, index: true }, // e.g., S, M, L
    sku: { type: String, required: true, unique: true }, // ERP/WMS friendly
    price: { type: Number, required: true },
    compareAtPrice: { type: Number, default: null },
    stock: { type: Number, default: 0 },
    barcode: { type: String, default: null },
  },
  { timestamps: true }
);

ProductVariantSchema.index({ product: 1, size: 1 }, { unique: true });
export default mongoose.model("ProductVariant", ProductVariantSchema);
