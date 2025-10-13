import Product from "../Models/Product.js";
import WishlistItem from "../Models/WishlistItem.js";
import { redis } from "../lib/redis.js";

const WL_TTL = 120;
const wlKey = (userId) => `wl:${userId}`;

async function getCachedWishlist(userId) {
  const cached = await redis.get(wlKey(userId));
  return cached ? JSON.parse(cached) : null;
}
async function setCachedWishlist(userId, payload, ttl = WL_TTL) {
  await redis.set(wlKey(userId), JSON.stringify(payload), { EX: ttl });
}
async function invalidateWishlist(userId) {
  await redis.del(wlKey(userId));
}

async function queryWishlistFromDB(userId) {
  const items = await WishlistItem.find({ user: userId })
    .populate({
      path: "product",
      select:
        "title slug color colorLabel coverImage priceFrom compareAtFrom inStock currency",
    })
    .lean();
  return { items };
}

async function refreshWishlistCache(userId) {
  await invalidateWishlist(userId);
  const payload = await queryWishlistFromDB(userId);
  await setCachedWishlist(userId, payload);
  return payload;
}

export async function getWishlist(req, res) {
  const userId = req.user?._id || req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const forceFresh =
    String(req.query.fresh || "").toLowerCase() === "1" ||
    String(req.query.fresh || "").toLowerCase() === "true";

  if (forceFresh) {
    const payload = await refreshWishlistCache(userId);
    return res.json(payload);
  }

  const cached = await getCachedWishlist(userId);
  if (cached) return res.json(cached);

  const payload = await queryWishlistFromDB(userId);
  await setCachedWishlist(userId, payload);
  return res.json(payload);
}


export async function addToWishlist(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    const { productId } = req.body || {};
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!productId)
      return res.status(400).json({ error: "productId is required" });

    const prod = await Product.findById(productId).select("_id");
    if (!prod) return res.status(404).json({ error: "Product not found" });

    const doc = await WishlistItem.findOneAndUpdate(
      { user: userId, product: productId },
      {
        $setOnInsert: { user: userId, product: productId, addedAt: new Date() },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    // LIVE refresh (invalidate -> read DB -> set cache)
    const wishlist = await refreshWishlistCache(userId);

    return res.json({ added: true, item: doc, ...wishlist });
  } catch (e) {
    if (e?.code === 11000)
      return res.json({ added: false, reason: "Already in wishlist" });
    return res.status(500).json({ error: "Something went wrong" });
  }
}

export async function removeFromWishlist(req, res) {
  const userId = req.user?._id || req.user?.id;
  const { itemId, productId } = req.body || {};
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const filter = itemId
    ? { _id: itemId, user: userId }
    : productId
    ? { user: userId, product: productId }
    : null;

  if (!filter)
    return res.status(400).json({ error: "Provide itemId or productId" });

  const deleted = await WishlistItem.findOneAndDelete(filter).lean();
  if (!deleted)
    return res.status(404).json({ error: "Wishlist item not found" });

  // LIVE refresh (invalidate -> read DB -> set cache)
  const wishlist = await refreshWishlistCache(userId);

  return res.json({ removed: true, item: deleted, ...wishlist });
}
