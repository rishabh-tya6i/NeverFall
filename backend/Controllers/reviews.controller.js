import mongoose from "mongoose";
import Review from "../Models/Review.js";
import Product from "../Models/Product.js";

const recomputeProductRatings = async (productId) => {
  const [agg] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    {
      $group: {
        _id: "$product",
        ratingAvg: { $avg: "$rating" },
        ratingCount: { $sum: 1 },
      },
    },
  ]);
  const ratingAvg = agg?.ratingAvg ? Number(agg.ratingAvg.toFixed(2)) : 0;
  const ratingCount = agg?.ratingCount ?? 0;
  await Product.updateOne(
    { _id: productId },
    { $set: { ratingAvg, ratingCount } }
  );
};

// ensure user owns the review
const assertOwnership = (review, userId) => {
  if (!review) return;
  if (String(review.user) !== String(userId)) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
};

const clampRating = (n) => Math.max(1, Math.min(5, Number(n) || 0));
const normalizeImages = (images) =>
  Array.isArray(images)
    ? images
        .map((x) => (typeof x === "string" ? { url: x } : x))
        .filter((x) => x && x.url)
        .slice(0, 6)
    : [];

// GET /api/reviews?productId=...&page=1&limit=10
export const getProductReviews = async (req, res) => {
  const { parentProductId } = req.query;
  if (!parentProductId || !mongoose.isValidObjectId(parentProductId)) {
    return res.status(400).json({ message: "Invalid productId" });
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

  const [items, total] = await Promise.all([
    Review.find({ product: parentProductId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Review.countDocuments({ product: parentProductId }),
  ]);

  res.json({ items, total, page, limit });
};

export const createReview = async (req, res) => {
  const userId = req.user?._id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const {
    productId,
    rating,
    body = "",
    images = [],
    orderId = null,
  } = req.body;
  if (!productId || !mongoose.isValidObjectId(productId))
    return res.status(400).json({ message: "Invalid productId" });

  const exists = await Review.findOne({
    product: productId,
    user: userId,
  }).lean();
  if (exists)
    return res
      .status(409)
      .json({ message: "You already reviewed this product" });

  const review = await Review.create({
    product: productId,
    user: userId,
    orderId: orderId && mongoose.isValidObjectId(orderId) ? orderId : undefined,
    rating: clampRating(rating),
    body: String(body).trim(),
    images: normalizeImages(images),
  });

  await recomputeProductRatings(productId);
  res.status(201).json({ review });
};

export const updateReview = async (req, res) => {
  const userId = req.user?._id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const { id } = req.params;
  if (!mongoose.isValidObjectId(id))
    return res.status(400).json({ message: "Invalid review id" });

  const review = await Review.findById(id);
  if (!review) return res.status(404).json({ message: "Review not found" });
  assertOwnership(review, userId);

  const { rating, body, images } = req.body;
  if (rating !== undefined) review.rating = clampRating(rating);
  if (body !== undefined) review.body = String(body).trim();
  if (images !== undefined) review.images = normalizeImages(images);

  await review.save();
  await recomputeProductRatings(review.product);
  res.json({ review });
};

// PATCH /api/reviews/:id/images/add
// Body: { images: [...] } (appends; capped at 6)
export const addReviewImages = async (req, res) => {
  const userId = req.user?._id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const { id } = req.params;
  if (!mongoose.isValidObjectId(id))
    return res.status(400).json({ message: "Invalid review id" });

  const review = await Review.findById(id);
  if (!review) return res.status(404).json({ message: "Review not found" });
  assertOwnership(review, userId);

  const incoming = normalizeImages(req.body?.images);
  review.images = [...review.images, ...incoming].slice(0, 6);
  await review.save();

  res.json({ review });
};

export const deleteReviewImage = async (req, res) => {
  const userId = req.user?._id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const { id } = req.params;
  if (!mongoose.isValidObjectId(id))
    return res.status(400).json({ message: "Invalid review id" });

  const { key, url } = req.query;
  if (!key && !url)
    return res.status(400).json({ message: "Missing key or url" });

  const review = await Review.findById(id);
  if (!review) return res.status(404).json({ message: "Review not found" });
  assertOwnership(review, userId);

  // DEMO: pretend to delete from storage (no-op). In real S3, delete by key.
  const before = review.images.length;
  review.images = review.images.filter((img) =>
    key ? img?.key !== key : img?.url !== url
  );
  const removed = review.images.length !== before;

  if (removed) await review.save();
  res.json({ review, removed });
};

// DELETE /api/reviews/:id
export const deleteReview = async (req, res) => {
  const userId = req.user?._id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const { id } = req.params;
  if (!mongoose.isValidObjectId(id))
    return res.status(400).json({ message: "Invalid review id" });

  const review = await Review.findById(id);
  if (!review) return res.status(404).json({ message: "Review not found" });
  assertOwnership(review, userId);

  // DEMO: if you stored keys, you could iterate and "delete" them here.
  const productId = review.product;
  await Review.deleteOne({ _id: id });

  await recomputeProductRatings(productId);
  res.json({ ok: true });
};

export const getMyReviewForProduct = async (req, res) => {
  const userId = req.user?._id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const { productId } = req.query;
  if (!productId || !mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ message: "Invalid productId" });
  }

  const review = await Review.findOne({
    product: productId,
    user: userId,
  }).lean();
  res.json({ review });
};
