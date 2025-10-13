import { Router } from "express";
import {
  createReview,
  updateReview,
  addReviewImages,
  deleteReviewImage,
  deleteReview,
  getMyReviewForProduct,
  getProductReviews,
} from "../Controllers/reviews.controller.js";
import { auth } from "../Middlewares/auth.js";

const router = Router();

router.get("/", getProductReviews);

router.get("/my", auth, getMyReviewForProduct);
router.post("/", auth, createReview);
router.put("/:id", auth, updateReview);

router.patch("/:id/images/add", auth, addReviewImages);
router.delete("/:id/images", auth, deleteReviewImage);
router.delete("/:id", auth, deleteReview);

export default router;
