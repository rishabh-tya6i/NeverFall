import mongoose from "mongoose";

const CouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: { type: String, default: "" },

    type: { type: String, enum: ["percentage", "fixed"], required: true },
    value: { type: Number, required: true },

    maxDiscountAmount: { type: Number, default: null },

    maxUses: { type: Number, default: null }, 
    maxUsesPerUser: { type: Number, default: 1 }, 

    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    applicableProductIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    ],
    applicableCategoryIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    ],

    minOrderValue: { type: Number, default: 0 },

    active: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },

    usesCount: { type: Number, default: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, 
  },
  { timestamps: true }
);

CouponSchema.index({ code: 1 });

export default mongoose.model("Coupon", CouponSchema);
