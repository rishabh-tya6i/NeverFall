import Review from "../../Models/Review.js";
import Product from "../../Models/Product.js";
import mongoose from "mongoose";
import logger from "../../utils/logger.js";

const recomputeProductRatings = async (productId) => {
  const [agg] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId), status: 'approved' } },
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

/**
 * Get all reviews with filtering and pagination
 */
export const getAllReviews = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      productId,
      userId,
      flagged,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (productId) query.product = productId;
    if (userId) query.user = userId;
    if (flagged) query.flagged = flagged === 'true';

    const sortOptions = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const reviews = await Review.find(query)
      .populate("user", "name email")
      .populate("product", "title")
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Review.countDocuments(query);

    res.json({
      reviews,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error("Failed to get all reviews:", error);
    res.status(500).json({ message: "Failed to retrieve reviews" });
  }
};

/**
 * Approve a review
 */
export const approveReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    review.status = "approved";
    await review.save();

    await recomputeProductRatings(review.product);

    logger.info(`Review ${review._id} approved by ${req.user.id}`);
    res.json(review);
  } catch (error) {
    logger.error("Failed to approve review:", error);
    res.status(500).json({ message: "Failed to approve review" });
  }
};

/**
 * Reject a review
 */
export const rejectReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    review.status = "rejected";
    await review.save();

    await recomputeProductRatings(review.product);

    logger.info(`Review ${review._id} rejected by ${req.user.id}`);
    res.json(review);
  } catch (error) {
    logger.error("Failed to reject review:", error);
    res.status(500).json({ message: "Failed to reject review" });
  }
};

/**
 * Flag a review for moderation
 */
export const flagReview = async (req, res) => {
    try {
      const { id } = req.params;
      const { flagged = true } = req.body;
      const review = await Review.findById(id);
  
      if (!review) {
        return res.status(404).json({ message: "Review not found" });
      }
  
      review.flagged = !!flagged;
      await review.save();
  
      logger.info(`Review ${review._id} flagged status set to ${review.flagged} by ${req.user.id}`);
      res.json(review);
    } catch (error) {
      logger.error("Failed to flag review:", error);
      res.status(500).json({ message: "Failed to flag review" });
    }
  };

/**
 * Delete a review (admin)
 */
export const deleteReviewAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    const productId = review.product;
    await Review.deleteOne({ _id: id });

    await recomputeProductRatings(productId);

    logger.info(`Review ${id} deleted by admin ${req.user.id}`);
    res.json({ ok: true, message: "Review deleted successfully" });
  } catch (error) {
    logger.error("Failed to delete review:", error);
    res.status(500).json({ message: "Failed to delete review" });
  }
};
