import { Router } from "express";
import { auth, isAdmin, isSupport } from "../../Middlewares/auth.js";
import {
  getAllOrders,
  updateOrderStatus,
  approveRefund,
  getOrderAnalytics,
} from "../../Controllers/admin/adminOrder.controller.js";

const router = Router();

router.get("/", auth, isSupport, getAllOrders);
router.get("/analytics", auth, isAdmin, getOrderAnalytics);

router.patch("/:id/status", auth, isAdmin, updateOrderStatus);
router.post("/:id/refund", auth, isAdmin, approveRefund);

export default router;