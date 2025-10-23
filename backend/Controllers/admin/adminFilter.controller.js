// controllers/adminFilter.controller.js
import CategoryFilterConfig from "../../Models/CategoryFilterConfig.js";
import mongoose from "mongoose";

/**
 * Validate options: accept either array of strings or array of {value,label,meta}
 */
function normalizeOptions(options = []) {
  if (!Array.isArray(options)) return [];
  return options
    .map((opt) => {
      if (typeof opt === "string")
        return { value: opt, label: String(opt), meta: {} };
      // if it's already object, ensure it has value and label
      return {
        value: String(opt.value ?? opt.v ?? ""),
        label: String(opt.label ?? opt.value ?? ""),
        meta: opt.meta ?? {},
      };
    })
    .filter((o) => o.value !== "");
}

/**
 * Build FilterMeta object from input safely
 */
function buildFilterMeta(input = {}) {
  const allowedTypes = ["enum", "range", "slider", "text", "swatch", "boolean"];
  const type = allowedTypes.includes(input.type) ? input.type : "enum";
  const options =
    type === "enum" || type === "swatch"
      ? normalizeOptions(input.options || [])
      : [];
  const min = typeof input.min === "number" ? input.min : null;
  const max = typeof input.max === "number" ? input.max : null;
  const showCounts =
    typeof input.showCounts === "boolean" ? input.showCounts : true;
  const order = Number.isInteger(input.order) ? input.order : 100;
  const visible = typeof input.visible === "boolean" ? input.visible : true;
  const meta = input.meta ?? {};
  return { type, options, min, max, showCounts, order, visible, meta };
}

export async function createOrUpdateConfig(req, res) {
  try {
    const { categoryId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(categoryId))
      return res.status(400).json({ error: "Invalid categoryId" });

    const payload = req.body || {};
    // normalize filters array (order)
    if (!Array.isArray(payload.filters)) payload.filters = [];

    // build meta map
    const metaObj = {};
    const metaInput = payload.meta || {};
    // metaInput expected to be plain object: { size: { type:'enum', options: [...] }, color: {...} }
    for (const key of Object.keys(metaInput)) {
      metaObj[key] = buildFilterMeta(metaInput[key]);
    }

    const data = {
      categoryId,
      filters: payload.filters,
      meta: metaObj,
      isActive: typeof payload.isActive === "boolean" ? payload.isActive : true,
      label: payload.label ?? "",
    };

    const upd = { ...data, updatedAt: new Date() };

    const doc = await CategoryFilterConfig.findOneAndUpdate(
      { categoryId },
      { $set: upd },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ success: true, config: doc });
  } catch (err) {
    console.error("createOrUpdateConfig:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

export async function getConfig(req, res) {
  try {
    const { categoryId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(categoryId))
      return res.status(400).json({ error: "Invalid categoryId" });

    const config = await CategoryFilterConfig.findOne({
      categoryId,
      isActive: true,
    }).lean();
    if (!config)
      return res
        .status(404)
        .json({ error: "No active filter config found for category" });
    return res.json({ config });
  } catch (err) {
    console.error("getConfig:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

export async function deleteConfig(req, res) {
  try {
    const { categoryId } = req.params;
    await CategoryFilterConfig.deleteOne({ categoryId });
    return res.json({ success: true });
  } catch (err) {
    console.error("deleteConfig:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

export async function listConfigs(req, res) {
  try {
    const configs = await CategoryFilterConfig.find({})
      .sort({ updatedAt: -1 })
      .lean();
    return res.json({ configs });
  } catch (err) {
    console.error("listConfigs:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
