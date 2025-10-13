// models/ParentProduct.js
import mongoose from "mongoose";
const ParentProductSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, default: "" },
    details: { type: Object, default: {} },
    tags: { type: [String], index: true, default: [] },
    categories: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      index: true,
    },

    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    CollectionType: {
      type: String,
      enum: ["Winter", "Summer"],
    },
  },
  { timestamps: true }
);

ParentProductSchema.index({ title: "text", description: "text", tags: "text" });
export default mongoose.model("ParentProduct", ParentProductSchema);
