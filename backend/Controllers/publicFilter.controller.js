// controllers/publicFilter.controller.js
import mongoose from "mongoose";
import CategoryFilterConfig from "../Models/CategoryFilterConfig.js";

/**
 * Normalize option entries into { value, label, meta }.
 * Accepts: ["S","M"] or [{value,label,meta}, ...] - returns cleaned array.
 */
function normalizeOptions(options = []) {
  if (!Array.isArray(options)) return [];
  return options
    .map((opt) => {
      if (typeof opt === "string") {
        const v = opt.trim();
        if (!v) return null;
        return { value: v, label: v, meta: {} };
      }
      if (opt && typeof opt === "object") {
        const value = String(opt.value ?? opt.v ?? "").trim();
        if (!value) return null;
        return {
          value,
          label: String(opt.label ?? opt.value ?? value),
          meta: opt.meta ?? {},
        };
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * Normalize a stored meta entry (FilterMetaSchema) into safe output.
 * Ensures options are normalized and removes internal fields if needed.
 */
function normalizeFilterMeta(key, meta = {}) {
  const out = {
    key,
    label: meta.label ?? key,
    type: meta.type ?? "enum",
    visible: typeof meta.visible === "boolean" ? meta.visible : true,
    order: Number.isFinite(meta.order) ? meta.order : 100,
    showCounts: typeof meta.showCounts === "boolean" ? meta.showCounts : false,
    meta: meta.meta ?? {},
  };

  if (out.type === "range" || out.type === "slider") {
    out.min = typeof meta.min === "number" ? meta.min : null;
    out.max = typeof meta.max === "number" ? meta.max : null;
  }

  if (out.type === "enum" || out.type === "swatch") {
    out.options = normalizeOptions(meta.options || []);
  } else {
    out.options = [];
  }

  return out;
}

/**
 * Public controller: GET /categories/:categoryId/filters
 * Returns admin-configured filters for that category (ordered).
 */
export async function getFiltersForCategoryPublic(req, res) {
  try {
    const { categoryId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ error: "Invalid categoryId" });
    }

    const config = await CategoryFilterConfig.findOne({
      categoryId,
      isActive: true,
    }).lean();

    if (!config) {
      return res.status(200).json({
        categoryId,
        filtersOrder: [],
        filters: {},
        message: "No filter configuration found for this category",
      });
    }

    // Build normalized filters map in the order of config.filters (if provided)
    const filtersOrder = Array.isArray(config.filters) ? config.filters : [];
    const normalizedFiltersMap = {};

    // Ensure config.meta may be a Map (Mongoose Map) or plain object
    const rawMeta =
      config.meta instanceof Map
        ? Object.fromEntries(config.meta)
        : config.meta || {};

    // First build entries for keys in filtersOrder in same order
    for (const key of filtersOrder) {
      const metaForKey = rawMeta[key] ?? {};
      normalizedFiltersMap[key] = normalizeFilterMeta(key, metaForKey);
    }

    // Then append any extras that exist in meta but not in filtersOrder
    for (const key of Object.keys(rawMeta)) {
      if (filtersOrder.includes(key)) continue;
      normalizedFiltersMap[key] = normalizeFilterMeta(key, rawMeta[key]);
      filtersOrder.push(key); // append so UI can render them after ordered ones
    }

    // Final response
    // Add caching hints: public results are safe to cache at CDN for 5 minutes (optional)
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
    return res.status(200).json({
      categoryId,
      filtersOrder,
      filters: normalizedFiltersMap,
      label: config.label ?? null,
      updatedAt: config.updatedAt ?? config.updatedAt,
    });
  } catch (err) {
    console.error("getFiltersForCategoryPublic:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
