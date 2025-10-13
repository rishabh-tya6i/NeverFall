import Router from "express";
import { auth, isAdmin } from "../Middlewares/auth.js";

import {
  createCoupon,
  validateCoupon,
} from "../Controllers/coupon.controller.js";

const router = Router();

router.post("/create", auth, isAdmin, createCoupon);
router.post("/use", validateCoupon);

export default router;
