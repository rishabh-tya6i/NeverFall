// models/CategoryFilterConfig.js
import mongoose from "mongoose";

const FilterMetaSchema = new mongoose.Schema(
  {
    // UI hint: enum | range | slider | text | color-swatch | boolean
    type: {
      type: String,
      enum: ["enum", "range", "slider", "text", "swatch", "boolean"],
      default: "enum",
    },

    // For enum: optional list of allowed values (admin can optionally seed)
    options: { type: [String], default: [] },

    // For range/slider: min/max defaults (may be null to indicate compute from data)
    min: { type: Number, default: null },
    max: { type: Number, default: null },

    // Whether to show counts next to option (frontend may request counts)
    showCounts: { type: Boolean, default: true },

    // Presentation ordering hint (smaller = shown earlier)
    order: { type: Number, default: 100 },

    // Whether this filter should be visible by default in UI
    visible: { type: Boolean, default: true },

    // Any additional free-form metadata (e.g., color hex mapping)
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const CategoryFilterConfigSchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      unique: true,
      index: true,
    },

    // Ordered list of filter keys to show on this category's product list page.
    // Example keys: "size", "color", "pattern", "fit", "material", "collar", "sleeves", "price"
    filters: { type: [String], default: [] },

    // Per-filter metadata to drive UI/behavior. Keys match values in "filters".
    // e.g. meta: { size: { type: 'enum', options: ['S','M','L'] }, price: { type: 'range' } }
    meta: { type: Map, of: FilterMetaSchema, default: {} },

    // Optional: whether this configuration is active. Use to toggle quickly from admin.
    isActive: { type: Boolean, default: true },

    // Optional human-friendly label for admin UI
    label: { type: String, default: "" },

    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// small helper index to query active configs quickly
CategoryFilterConfigSchema.index({ isActive: 1, categoryId: 1 });

export default mongoose.model(
  "CategoryFilterConfig",
  CategoryFilterConfigSchema
);
