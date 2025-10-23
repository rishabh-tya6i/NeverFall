import { Router } from "express";
import { auth, isAdmin } from "../../Middlewares/auth.js";
import {
  getAllPayments,
  // processManualRefund,
  getPaymentAnalytics,
} from "../../Controllers/admin/adminPayment.controller.js";

const router = Router();

router.use(auth, isAdmin);

router.get("/", getAllPayments);
router.get("/analytics", getPaymentAnalytics);
// router.post("/:paymentId/refund", processManualRefund);

export default router;
