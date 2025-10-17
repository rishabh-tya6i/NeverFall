import { Router } from "express";
import { auth, isSupport } from "../../Middlewares/auth.js";
import {
  getAllReviews,
  approveReview,
  rejectReview,
  deleteReviewAdmin,
  flagReview,
} from "../../Controllers/admin/adminReview.controller.js";

const router = Router();

router.use(auth, isSupport);

router.get("/", getAllReviews);
router.patch("/:id/approve", approveReview);
router.patch("/:id/reject", rejectReview);
router.patch("/:id/flag", flagReview);
router.delete("/:id", deleteReviewAdmin);

export default router;