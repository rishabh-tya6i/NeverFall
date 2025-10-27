import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    path: { type: String, index: true }, // e.g. "men/tops/hoodies"
    image: { type: String, default: null },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CategorySchema.index({ parent: 1, name: 1 }, { unique: true });

CategorySchema.pre("save", async function (next) {
  if (!this.isModified("slug") && !this.isModified("parent")) return next();
  const parent = this.parent
    ? await this.model("Category").findById(this.parent)
    : null;
  this.path = parent ? `${parent.path}/${this.slug}` : this.slug;
  next();
});

export default mongoose.model("Category", CategorySchema);
