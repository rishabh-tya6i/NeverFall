// controllers/productPublic.js
import mongoose from "mongoose";
import Product from "../Models/Product.js";
import ParentProduct from "../Models/ParentProduct.js";
import Category from "../Models/Category.js";
import ProductVariant from "../Models/ProductVariant.js";
import Cart from "../Models/Cart.js";
import WishlistItem from "../Models/WishlistItem.js";
import Review from "../Models/Review.js";
import { redis } from "../lib/redis.js";
import { cacheGet as redisGet, cacheSet as redisSet } from "../lib/cache.js";

// const cacheGet = async (key) => {
//   const v = await redis.get(key);
//   return v ? JSON.parse(v) : null;
// };
// const cacheSet = async (key, val, ttl = 120) => {
//   await redis.set(key, JSON.stringify(val), { EX: ttl });
// };
const cacheKeyFromReq = (req, prefix) =>
  `${prefix}:${req.originalUrl.replace(/\W+/g, ":")}`.toLowerCase();

const toNum = (v, d) => (v !== undefined && v !== null ? Number(v) : d);
const toArr = (v) =>
  typeof v === "string"
    ? v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : Array.isArray(v)
    ? v
    : [];

const encodeCursor = (obj) =>
  Buffer.from(JSON.stringify(obj)).toString("base64");
const decodeCursor = (str) => {
  if (!str) return null;
  try {
    return JSON.parse(Buffer.from(String(str), "base64").toString("utf8"));
  } catch {
    return null;
  }
};

/* -------------------------------------------------------------
   Common product projection for lists (color-level Product)
------------------------------------------------------------- */
const listSelect = {
  title: 1,
  slug: 1,
  color: 1,
  colorLabel: 1,
  coverImage: 1,
  images: 1,
  priceFrom: 1,
  compareAtFrom: 1,
  inStock: 1,
  availableSizes: 1,
  currency: 1,
  collections: 1,
  publishAt: 1,
  isTrending: 1,
  clicks: 1,
  purchases: 1,
};

const buildFilter = async (q) => {
  const filter = {};

  // Handle category filtering by primaryCategoryId
  const categories = toArr(q.categories);
  if (categories.length) {
    // Convert category names/slugs to ObjectIds
    const categoryIds = [];
    const categoryNames = [];

    for (const cat of categories) {
      if (mongoose.Types.ObjectId.isValid(cat)) {
        categoryIds.push(new mongoose.Types.ObjectId(cat));
      } else {
        categoryNames.push(cat);
      }
    }

    // If we have category names/slugs, resolve them to ObjectIds
    if (categoryNames.length) {
      const resolvedCategories = await Category.find({
        $or: [
          { name: { $in: categoryNames } },
          { slug: { $in: categoryNames } },
        ],
      })
        .select("_id")
        .lean();

      const resolvedIds = resolvedCategories.map((cat) => cat._id);
      categoryIds.push(...resolvedIds);
    }

    if (categoryIds.length) {
      filter.primaryCategoryId = { $in: categoryIds };
    }
  }

  const colors = toArr(q.colors);
  if (colors.length) filter.color = { $in: colors.map((c) => c.toLowerCase()) };

  const sizes = toArr(q.sizes);
  if (sizes.length)
    filter.availableSizes = { $in: sizes.map((s) => s.toUpperCase()) };

  const tags = toArr(q.tags);
  if (tags.length) filter.tags = { $in: tags.map((t) => t.toLowerCase()) }; // only if Product has tags

  // price range applies to priceFrom
  const priceMin = toNum(q.priceMin, null);
  const priceMax = toNum(q.priceMax, null);
  if (priceMin !== null || priceMax !== null) {
    filter.priceFrom = {};
    if (priceMin !== null) filter.priceFrom.$gte = priceMin;
    if (priceMax !== null) filter.priceFrom.$lte = priceMax;
  }

  return filter;
};

/* -------------------------------------------------------------
   Cursor helpers for list/search sorts
------------------------------------------------------------- */
const afterByPublish = (cursor) => {
  if (!cursor?.publishAt || !cursor?._id) return {};
  const d = new Date(cursor.publishAt);
  return {
    $or: [
      { publishAt: { $lt: d } },
      { publishAt: d, _id: { $lt: new mongoose.Types.ObjectId(cursor._id) } },
    ],
  };
};

const afterByScore = (cursor) => {
  if (cursor?.score === undefined || !cursor?._id) return {};
  return {
    $or: [
      { score: { $lt: cursor.score } },
      {
        score: cursor.score,
        _id: { $lt: new mongoose.Types.ObjectId(cursor._id) },
      },
    ],
  };
};

/* -------------------------------------------------------------
   Sort mapping + generic "after" condition for cursors
   (rating fallback -> purchases/clicks since Product has no rating fields)
------------------------------------------------------------- */
const buildSort = (sortKey = "new") => {
  switch (String(sortKey).toLowerCase()) {
    case "price_asc":
      return {
        primary: "priceFrom",
        order: "asc",
        sort: { priceFrom: 1, _id: 1 },
      };
    case "price_desc":
      return {
        primary: "priceFrom",
        order: "desc",
        sort: { priceFrom: -1, _id: -1 },
      };
    case "rating":
      // Fallback: purchases/clicks desc (since ratingAvg not on Product schema)
      return {
        primary: "purchases",
        order: "desc",
        sort: { purchases: -1, clicks: -1, publishAt: -1, _id: -1 },
        ties: ["clicks", "publishAt"],
      };
    case "popular":
      return {
        primary: "purchases",
        order: "desc",
        sort: { purchases: -1, clicks: -1, publishAt: -1, _id: -1 },
        ties: ["clicks", "publishAt"],
      };
    case "new":
    default:
      return {
        primary: "publishAt",
        order: "desc",
        sort: { publishAt: -1, _id: -1 },
      };
  }
};

const afterBySort = (cursor, config) => {
  if (!cursor) return {};
  const { primary, order, ties = [] } = config;
  if (cursor[primary] === undefined && primary !== "publishAt") return {};
  const parts = [...ties, "_id"];
  const dir = order === "asc" ? 1 : -1;

  const valOf = (field) => {
    if (field === "publishAt") return new Date(cursor.publishAt);
    if (field === "_id") return new mongoose.Types.ObjectId(cursor._id);
    return cursor[field];
  };

  const strictCmp = (field) => {
    const v = valOf(field);
    if (field === "_id")
      return dir === 1 ? { _id: { $gt: v } } : { _id: { $lt: v } };
    if (field === "publishAt")
      return dir === 1 ? { publishAt: { $gt: v } } : { publishAt: { $lt: v } };
    return dir === 1 ? { [field]: { $gt: v } } : { [field]: { $lt: v } };
  };

  const equality = (field) => {
    const v = valOf(field);
    return field === "publishAt"
      ? { publishAt: v }
      : field === "_id"
      ? { _id: v }
      : { [field]: v };
  };

  const ladders = [];
  for (let i = 0; i <= parts.length; i++) {
    const strictField = i === 0 ? primary : parts[i - 1];
    const eqFields = i === 0 ? [] : [primary, ...parts.slice(0, i - 1)];
    ladders.push({ $and: [...eqFields.map(equality), strictCmp(strictField)] });
  }
  return { $or: ladders };
};

/* -------------------------------------------------------------
   Variant helpers (aligned to new ProductVariant schema)
------------------------------------------------------------- */
const toCardVariant = (variant, product) => {
  if (!variant) return null;
  const image = product?.images?.[0]?.url || product?.coverImage || null;
  return {
    sku: variant.sku,
    size: variant.size,
    price: variant.price,
    compareAtPrice: variant.compareAtPrice ?? null,
    image,
    inStock: (variant.stock ?? 0) > 0,
  };
};

const resolveDefaultVariant = async (product) => {
  if (!product) return null;
  // Prefer in-stock cheapest; else cheapest
  const variants = await ProductVariant.find({ product: product._id })
    .select("sku size price compareAtPrice stock")
    .sort({ price: 1, _id: 1 })
    .lean();

  if (!variants.length) return null;
  const inStock = variants.find((v) => (v.stock ?? 0) > 0);
  return inStock || variants[0];
};

const resolveInitialVariantForPDP = async (product, skuFromQuery) => {
  if (!product) return null;
  if (skuFromQuery) {
    const bySku = await ProductVariant.findOne({
      product: product._id,
      sku: String(skuFromQuery),
    })
      .select("sku size price compareAtPrice stock")
      .lean();
    if (bySku) return bySku;
  }
  return resolveDefaultVariant(product);
};

/* =============================================================
   COLOR FEED
   With color-as-product, the "color feed" is simply Product cards.
   We still compute a representative variant for price/image/inStock.
============================================================= */

/**
 * Color feed for homepage
 * GET /api/products/color-feed?limit=24&cursor=<base64>&sort=popular&seed=YYYYMMDD
 * - cursor: base64 {"offset": number} on a cached array
 */
export const getColorVariantFeed = async (req, res) => {
  const limit = Math.min(60, Math.max(1, toNum(req.query.limit, 24)));
  const cursor = decodeCursor(req.query.cursor) || { offset: 0 };
  const sortKey = req.query.sort || "popular";
  const seed =
    req.query.seed || new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const cacheKey = `feed:color:${sortKey}:${seed}:v2`;

  let seq = await cacheGet(cacheKey);

  if (!seq) {
    const P = limit * 5; // cache ahead
    const products = await Product.find({})
      .select(listSelect)
      .sort(
        sortKey === "new"
          ? { publishAt: -1, _id: -1 }
          : sortKey === "price_asc"
          ? { priceFrom: 1, _id: 1 }
          : sortKey === "price_desc"
          ? { priceFrom: -1, _id: -1 }
          : { purchases: -1, clicks: -1, publishAt: -1, _id: -1 }
      )
      .limit(P)
      .lean();

    // Attach representative variant card data
    seq = [];
    for (const p of products) {
      const rep = await resolveDefaultVariant(p);
      const card = toCardVariant(rep, p);
      seq.push({
        productId: String(p._id),
        slug: p.slug,
        title: p.title,
        color: p.color,
        colorLabel: p.colorLabel,
        priceFrom: p.priceFrom,
        compareAtFrom: p.compareAtFrom,
        inStock: p.inStock,
        currency: p.currency,
        // representative variant details for the card:
        cardVariant: card,
      });
    }

    await cacheSet(cacheKey, seq, 120);
  }

  const start = cursor.offset || 0;
  const end = start + limit;
  const slice = seq.slice(start, end);
  const nextCursor = end < seq.length ? encodeCursor({ offset: end }) : null;

  res.json({ items: slice, nextCursor, limit, seed });
};

/* -------------------------------------------------------------
   1) ALL PRODUCTS (cursor-based) + cardVariant + sorting
------------------------------------------------------------- */
//Working
export const getAllProducts = async (req, res) => {
  console.log("getAllProducts called");
  const limit = Math.min(60, Math.max(1, toNum(req.query.limit, 24)));
  const cursor = decodeCursor(req.query.cursor);
  const sortCfg = buildSort(req.query.sort);

  const key = cacheKeyFromReq(req, "prd:all:cursor");
  const cached = await redisGet(key);
  if (cached) return res.json(cached);
  console.log("cache miss", key);

  const after = afterBySort(cursor, sortCfg);
  const items = await Product.find(after)
    .select(listSelect)
    .sort(sortCfg.sort)
    .limit(limit)
    .lean();

  const last = items[items.length - 1];
  const nextCursor =
    items.length === limit
      ? encodeCursor({
          _id: last?._id,
          publishAt: last?.publishAt,
          priceFrom: last?.priceFrom,
          purchases: last?.purchases,
          clicks: last?.clicks,
        })
      : null;

  const withCardVariant = await Promise.all(
    items.map(async (p) => {
      const base = await resolveDefaultVariant(p);
      const cardVariant = toCardVariant(base, p);
      return { ...p, cardVariant };
    })
  );

  const payload = { items: withCardVariant, nextCursor, limit };
  console.log("payload is", payload);
  await redisSet(key, payload, 120);
  res.json(payload);
};

//Working

export const getProductsByFilter = async (req, res) => {
  const limit = Math.min(60, Math.max(1, toNum(req.query.limit, 24)));
  const cursor = decodeCursor(req.query.cursor);
  const sortCfg = buildSort(req.query.sort);
  const filter = await buildFilter(req.query);

  const key = cacheKeyFromReq(req, "prd:filter:cursor");
  const cached = await redisGet(key);
  if (cached) return res.json(cached);

  const after = afterBySort(cursor, sortCfg);
  const items = await Product.find({ ...filter, ...after })
    .select(listSelect)
    .sort(sortCfg.sort)
    .limit(limit)
    .lean();

  const last = items[items.length - 1];
  const nextCursor =
    items.length === limit
      ? encodeCursor({
          _id: last?._id,
          publishAt: last?.publishAt,
          priceFrom: last?.priceFrom,
          purchases: last?.purchases,
          clicks: last?.clicks,
        })
      : null;

  const withCardVariant = await Promise.all(
    items.map(async (p) => {
      const base = await resolveDefaultVariant(p);
      const cardVariant = toCardVariant(base, p);
      return { ...p, cardVariant };
    })
  );

  const payload = { items: withCardVariant, nextCursor, limit };
  await redisSet(key, payload, 300);
  res.json(payload);
};

//Recommended products
export const getRecommendations = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id || req.query.userId;
    if (!userId) return res.status(400).json({ message: "userId required" });

    const limit = Math.min(30, Math.max(10, toNum(req.query.limit, 30)));
    const cacheKey = cacheKeyFromReq(req, "prd:recommendations");

    // Try cache
    const cached = await redisGet(cacheKey);
    if (cached) return res.json(cached);

    // 1) Fetch cart and wishlist
    const [cart, wishlistItems] = await Promise.all([
      Cart.findOne({ user: userId })
        .lean()
        .catch(() => null),
      WishlistItem.find({ user: userId })
        .lean()
        .catch(() => []),
    ]);

    // collect product ids to exclude (wishlist has product-level ids)
    const wishlistProductIds = wishlistItems.map((w) => String(w.product));

    // cart stores ParentProduct refs (per your cart model)
    const cartParentIds = (cart?.items || []).map((i) => String(i.product));

    // 2) Gather parent IDs from wishlist (wishlist stores color Product), so resolve product -> parent
    let wishlistParentIds = [];
    if (wishlistProductIds.length) {
      const wishProducts = await Product.find({
        _id: { $in: wishlistProductIds },
      })
        .select("parent")
        .lean();
      wishlistParentIds = wishProducts
        .map((p) => String(p.parent))
        .filter(Boolean);
    }

    // Build priority parents: cart parents first, then wishlist parents (avoid duplicates)
    const priorityParentIds = [
      ...new Set([...cartParentIds, ...wishlistParentIds]),
    ].filter(Boolean);

    // 3) Resolve categories from those parent products (ParentProduct.categories)
    let categoryIds = [];
    if (priorityParentIds.length) {
      const parents = await ParentProduct.find({
        _id: { $in: priorityParentIds },
      })
        .select("categories")
        .lean();
      categoryIds = parents
        .map((p) => (p.categories ? String(p.categories) : null))
        .filter(Boolean);
    }

    // If no cart/wishlist parents -> no category-based recommendation
    let recommendedProducts = [];

    const excludedProductIds = new Set([
      ...wishlistProductIds, // exclude exact wishlist color-products
    ]);

    // Also exclude any product whose parent is in cart (so user doesn't get the same parent they already put in cart)
    // We'll collect product ids to exclude later after fetching by parent check.

    // 4) If we have categoryIds, first fetch Products in those categories
    if (categoryIds.length) {
      // find parent products in these categories
      const parentsInCats = await ParentProduct.find({
        categories: {
          $in: categoryIds.map((c) => new mongoose.Types.ObjectId(c)),
        },
      })
        .select("_id")
        .lean();

      const parentIdsInCats = parentsInCats.map((p) => String(p._id));

      // fetch Products (color-level) for those parents
      const productsInCats = await Product.find({
        parent: {
          $in: parentIdsInCats.map((id) => new mongoose.Types.ObjectId(id)),
        },
        // optional: only published/inStock items
        publishAt: { $lte: new Date() },
      })
        .select(listSelect)
        .sort({ purchases: -1, clicks: -1, publishAt: -1 })
        .limit(limit * 2) // fetch extra to filter excludes and still have room
        .lean();

      // filter out exact wishlist product IDs and products that have parent equal to cart parents (so we recommend 'other' products)
      const filtered = productsInCats.filter(
        (p) =>
          !excludedProductIds.has(String(p._id)) &&
          !cartParentIds.includes(String(p.parent))
      );

      // keep unique products (by _id) and slice to limit
      const uniqById = [];
      const seen = new Set();
      for (const p of filtered) {
        const id = String(p._id);
        if (!seen.has(id)) {
          seen.add(id);
          uniqById.push(p);
        }
        if (uniqById.length >= limit) break;
      }

      recommendedProducts = uniqById;
    }

    // 5) If we don't have enough (or had no categories at all), fallback to popular items
    if (recommendedProducts.length < Math.min(10, limit)) {
      // assemble exclusion list: wishlist product ids + already selected product ids
      const selectedIds = recommendedProducts.map((p) => String(p._id));
      const excludeIds = [
        ...new Set([...wishlistProductIds, ...selectedIds]),
      ].map((id) => new mongoose.Types.ObjectId(id));

      // fetch popular products to fill up to at least 10 (or requested limit)
      const need =
        Math.min(limit, Math.max(10, limit)) - recommendedProducts.length;
      const popular = await Product.find({
        _id: { $nin: excludeIds },
        publishAt: { $lte: new Date() },
      })
        .select(listSelect)
        .sort({ purchases: -1, clicks: -1, publishAt: -1 })
        .limit(need * 2)
        .lean();

      // add until we reach required count (up to limit)
      for (const p of popular) {
        if (recommendedProducts.length >= limit) break;
        if (
          !recommendedProducts.find((rp) => String(rp._id) === String(p._id))
        ) {
          recommendedProducts.push(p);
        }
      }
    }

    // ensure final size between min 10 and max limit (but if DB doesn't have enough, return what we have)
    if (recommendedProducts.length > limit)
      recommendedProducts = recommendedProducts.slice(0, limit);

    // 6) Attach representative variant (cardVariant)
    const withCardVariant = await Promise.all(
      recommendedProducts.map(async (p) => {
        const base = await resolveDefaultVariant(p);
        const cardVariant = toCardVariant(base, p);
        return { ...p, cardVariant };
      })
    );

    const payload = {
      items: withCardVariant,
      count: withCardVariant.length,
      source: {
        usedCategories: categoryIds,
        usedParents: priorityParentIds,
        fromCart: cartParentIds.length > 0,
        fromWishlist: wishlistParentIds.length > 0,
      },
    };

    // cache short (120s)
    await redisSet(cacheKey, payload, 120);
    return res.json(payload);
  } catch (err) {
    console.error("getRecommendations error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Get all Categories
// Get all Categories
export const GetAllCategories = async (req, res) => {
  try {
    // Fetch all categories from the database
    const categories = await Category.find({});

    // If no categories found
    if (!categories || categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No categories found",
      });
    }

    // Success response
    return res.status(200).json({
      success: true,
      message: "All categories returned successfully",
      data: categories,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching categories",
      error: error.message,
    });
  }
};

//Working

export const getProductsBySearch = async (req, res) => {
  const q = (req.query.q || "").trim();
  const limit = Math.min(60, Math.max(1, toNum(req.query.limit, 24)));
  const cursor = decodeCursor(req.query.cursor);

  const key = cacheKeyFromReq(req, "prd:search:cursor");
  const cached = await redisGet(key);
  if (cached) return res.json(cached);

  if (!q) {
    const payload = { items: [], nextCursor: null, limit, q: "" };
    await redisSet(key, payload, 30);
    return res.json(payload);
  }

  const find = { $text: { $search: q } };
  const after = afterByScore(cursor);

  const items = await Product.find({ ...find, ...after })
    .select({ ...listSelect, score: { $meta: "textScore" } })
    .sort({ score: { $meta: "textScore" }, _id: -1 })
    .limit(limit)
    .lean();

  const withCardVariant = await Promise.all(
    items.map(async (p) => {
      const base = await resolveDefaultVariant(p);
      const cardVariant = toCardVariant(base, p);
      return { ...p, cardVariant };
    })
  );

  const nextCursor =
    items.length === limit
      ? encodeCursor({
          score: items[items.length - 1].score ?? 0,
          _id: items[items.length - 1]._id,
        })
      : null;

  const payload = { items: withCardVariant, nextCursor, limit, q };
  await redisSet(key, payload, 60);
  res.json(payload);
};

/* -------------------------------------------------------------
   4) FACETS (color / size / tags / publish range) from Product
------------------------------------------------------------- */

//Getting Different varients of products

export const getFacets = async (req, res) => {
  console.log("getFacets called");
  const filter = await buildFilter(req.query);
  const key = cacheKeyFromReq(req, "prd:facets");
  const cached = await redisGet(key);
  if (cached) return res.json(cached);
  console.log("facet cache miss", key);

  const [facet] = await Product.aggregate([
    { $match: filter },
    {
      $facet: {
        colors: [
          { $group: { _id: "$color", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        sizes: [
          { $unwind: "$availableSizes" },
          { $group: { _id: "$availableSizes", count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ],
        categories: [
          { $match: { primaryCategoryId: { $ne: null } } },
          {
            $lookup: {
              from: "categories",
              localField: "primaryCategoryId",
              foreignField: "_id",
              as: "category",
            },
          },
          { $unwind: "$category" },
          {
            $group: {
              _id: "$primaryCategoryId",
              name: { $first: "$category.name" },
              slug: { $first: "$category.slug" },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ],
        tags: [
          { $unwind: "$tags" },
          { $group: { _id: "$tags", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 40 },
        ],
        publishRange: [
          {
            $group: {
              _id: null,
              min: { $min: "$publishAt" },
              max: { $max: "$publishAt" },
            },
          },
        ],
      },
    },
  ]);
  console.log("facet is", facet);
  const payload = {
    colors: facet?.colors?.map((x) => ({ color: x._id, count: x.count })) ?? [],
    sizes: facet?.sizes?.map((x) => ({ size: x._id, count: x.count })) ?? [],
    categories:
      facet?.categories?.map((x) => ({
        categoryId: x._id,
        name: x.name,
        slug: x.slug,
        count: x.count,
      })) ?? [],
    tags: facet?.tags?.map((x) => ({ tag: x._id, count: x.count })) ?? [],
    publishRange: facet?.publishRange?.[0] ?? null,
  };

  await redisSet(key, payload, 120);
  res.json(payload);
};

/* -------------------------------------------------------------
   5) NEW ARRIVALS (cursor-based) + cardVariant
------------------------------------------------------------- */
export const getNewArrivals = async (req, res) => {
  const limit = Math.min(60, Math.max(1, toNum(req.query.limit, 24)));
  const cursor = decodeCursor(req.query.cursor);
  const key = cacheKeyFromReq(req, "prd:new:cursor");
  const cached = await redisGet(key);
  if (cached) return res.json(cached);

  const after = afterByPublish(cursor);
  const items = await Product.find(after)
    .select(listSelect)
    .sort({ publishAt: -1, _id: -1 })
    .limit(limit)
    .lean();

  const withCardVariant = await Promise.all(
    items.map(async (p) => {
      const base = await resolveDefaultVariant(p);
      const cardVariant = toCardVariant(base, p);
      return { ...p, cardVariant };
    })
  );

  const nextCursor =
    items.length === limit
      ? encodeCursor({
          publishAt: items[items.length - 1].publishAt,
          _id: items[items.length - 1]._id,
        })
      : null;

  const payload = { items: withCardVariant, nextCursor, limit };
  await redisSet(key, payload, 300);
  res.json(payload);
};

/* -------------------------------------------------------------
   6) FEATURED (cursor-based) + cardVariant
------------------------------------------------------------- */
export const getFeatured = async (req, res) => {
  const limit = Math.min(60, Math.max(1, toNum(req.query.limit, 24)));
  const cursor = decodeCursor(req.query.cursor);
  const key = cacheKeyFromReq(req, "prd:feat:cursor");
  const cached = await redisGet(key);
  if (cached) return res.json(cached);

  const after = afterByPublish(cursor);
  const filter = { collections: { $in: ["featured"] } };
  const items = await Product.find({ ...filter, ...after })
    .select(listSelect)
    .sort({ publishAt: -1, _id: -1 })
    .limit(limit)
    .lean();

  const withCardVariant = await Promise.all(
    items.map(async (p) => {
      const base = await resolveDefaultVariant(p);
      const cardVariant = toCardVariant(base, p);
      return { ...p, cardVariant };
    })
  );

  const nextCursor =
    items.length === limit
      ? encodeCursor({
          publishAt: items[items.length - 1].publishAt,
          _id: items[items.length - 1]._id,
        })
      : null;

  const payload = { items: withCardVariant, nextCursor, limit };
  await redisSet(key, payload, 300);
  res.json(payload);
};

/* -------------------------------------------------------------
   7) TRENDING (with your fallback logic) + cardVariant
------------------------------------------------------------- */
export const getTrending = async (req, res) => {
  const limit = Math.min(60, Math.max(1, toNum(req.query.limit, 24)));
  const cursor = decodeCursor(req.query.cursor);
  const cacheKey = cacheKeyFromReq(req, "prd:trending:cursor");
  const cached = await redisGet(cacheKey);
  if (cached) return res.json(cached);

  const after = afterByPublish(cursor);

  let items = await Product.find({ isTrending: true, ...after })
    .select(listSelect)
    .sort({ publishAt: -1, _id: -1 })
    .limit(limit)
    .lean();

  if (items.length < limit && items.length < 30) {
    const excludeIds = items.map((i) => i._id);
    const more = await Product.find({
      purchases: { $gte: 10 },
      _id: { $nin: excludeIds },
      ...after,
    })
      .select(listSelect)
      .sort({ purchases: -1, publishAt: -1, _id: -1 })
      .limit(limit - items.length)
      .lean();
    items = items.concat(more);
  }

  if (items.length < limit && items.length < 30) {
    const excludeIds = items.map((i) => i._id);
    const more = await Product.find({
      clicks: { $gt: 0 },
      _id: { $nin: excludeIds },
      ...after,
    })
      .select(listSelect)
      .sort({ clicks: -1, publishAt: -1, _id: -1 })
      .limit(limit - items.length)
      .lean();
    items = items.concat(more);
  }

  if (items.length < limit && items.length < 30) {
    const excludeIds = items.map((i) => i._id);
    const more = await Product.find({ _id: { $nin: excludeIds }, ...after })
      .select(listSelect)
      .sort({ publishAt: -1, _id: -1 })
      .limit(limit - items.length)
      .lean();
    items = items.concat(more);
  }

  const withCardVariant = await Promise.all(
    items.map(async (p) => {
      const base = await resolveDefaultVariant(p);
      const cardVariant = toCardVariant(base, p);
      return { ...p, cardVariant };
    })
  );

  const nextCursor =
    items.length === limit
      ? encodeCursor({
          publishAt: items[items.length - 1].publishAt,
          _id: items[items.length - 1]._id,
        })
      : null;

  const payload = { items: withCardVariant, nextCursor, limit };
  await redisSet(cacheKey, payload, 120);
  res.json(payload);
};

export const getProductDetails = async (req, res) => {
  const { idOrSlug } = req.params;
  const isAdmin = String(req.query.admin).toLowerCase() === "true";
  const requestedSku = (req.query.sku || "").trim() || null;

  const key = cacheKeyFromReq(
    req,
    `prd:detail:${idOrSlug}:${isAdmin ? "a" : "u"}`
  );
  const cached = await redisGet(key);
  if (cached) return res.json(cached);

  const isId = mongoose.isValidObjectId(idOrSlug);
  const product = await Product.findOne(
    isId ? { _id: idOrSlug } : { slug: idOrSlug.toLowerCase() }
  ).lean();
  if (!product) return res.status(404).json({ message: "Product not found" });

  if (!isAdmin) {
    await Product.updateOne({ _id: product._id }, { $inc: { clicks: 1 } });
  }
  const parent = await ParentProduct.findById(product.parent);
  console.log("parent is", parent);

  const initialVariant = await resolveInitialVariantForPDP(
    product,
    requestedSku
  );
  if (!initialVariant) {
    return res
      .status(404)
      .json({ message: "No variants available for this product" });
  }
  const initial = toCardVariant(initialVariant, product);
  const initialVariantSku = initial?.sku ?? null;

  const variants = await ProductVariant.find({ product: product._id })
    .select("sku size price compareAtPrice stock")
    .lean();

  // Reviews (optional model)
  const page = Math.max(1, toNum(req.query.page, 1));
  const perPage = Math.min(50, Math.max(1, toNum(req.query.limit, 10)));
  const [reviews, reviewTotal] = await Promise.all([
    Review.find({ product: product._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .lean()
      .catch(() => []),
    Review.countDocuments({ product: product._id }).catch(() => 0),
  ]);

  const payload = {
    product,
    parent: parent.description ? parent : null,
    initialVariantSku,
    initialVariant: initial,
    variants, // includes stock field directly
    reviews: { items: reviews, total: reviewTotal, page, limit: perPage },
  };

  await redisSet(key, payload, 300);
  res.json(payload);
};

/* -------------------------------------------------------------
   9) VARIANT LOOKUP (SKU or productId+size)
------------------------------------------------------------- */
export const getVariantByKey = async (req, res) => {
  console.log("getVariantByKey called");
  const { sku, productId, size } = req.query;
  if (!sku && !(productId && size)) {
    return res.status(400).json({
      message: "Provide ?sku=... OR ?productId=...&size=...",
    });
  }

  const key = cacheKeyFromReq(req, "var:lookup");
  const cached = await cacheGet(key);
  if (cached) return res.json(cached);

  const query = sku
    ? { sku: String(sku) }
    : {
        product: new mongoose.Types.ObjectId(productId),
        size: String(size).toUpperCase(),
      };

  const variant = await ProductVariant.findOne(query)
    .select("sku size price compareAtPrice stock product")
    .lean();
  if (!variant) return res.status(404).json({ message: "Variant not found" });

  const product = await Product.findById(variant.product)
    .select({ title: 1, slug: 1, coverImage: 1, color: 1, colorLabel: 1 })
    .lean();

  const payload = { variant, product };
  await cacheSet(key, payload, 120);
  res.json(payload);
};

/* -------------------------------------------------------------
   Optional: explicit click tracker
------------------------------------------------------------- */
export const trackClick = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id))
    return res.status(400).json({ error: "Invalid product id" });
  await Product.updateOne({ _id: id }, { $inc: { clicks: 1 } });
  res.json({ ok: true });
};
