import mongoose from "mongoose";

const ImageSchema = new mongoose.Schema(
  {
    url: String,
    alt: String,
  },
  { _id: false }
);

const ProductSchema = new mongoose.Schema(
  {
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParentProduct",
      index: true,
    },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    color: { type: String, required: true, lowercase: true, index: true },
    colorLabel: { type: String, default: "" },

    coverImage: { type: String },
    images: { type: [ImageSchema], default: [] },

    priceFrom: { type: Number, required: true },
    compareAtFrom: { type: Number, default: null },
    inStock: { type: Boolean, default: true },
    availableSizes: [{ type: String, uppercase: true, index: true }],

    currency: { type: String, default: "INR" },
    isTrending: { type: Boolean, default: false, index: true },
    collections: [{ type: String, index: true }],
    publishAt: { type: Date, index: true },
    primaryCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      index: true,
      default: null,
    },
    clicks: { type: Number, default: 0 },
    purchases: { type: Number, default: 0 },
    meta: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

ProductSchema.index({ title: "text", colorLabel: "text" });
export default mongoose.model("Product", ProductSchema);
