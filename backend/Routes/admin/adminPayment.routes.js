import { Router } from "express";
import { auth, isAdmin } from "../../Middlewares/auth.js";
import {
  getAllPayments,
  getPaymentAnalytics,
} from "../../Controllers/admin/adminPayment.controller.js";

const router = Router();

router.use(auth, isAdmin);

router.get("/", getAllPayments);
router.get("/analytics", getPaymentAnalytics);

export default router;