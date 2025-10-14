import express from "express";
import {
  createOrder,
  getOrder,
  listOrders,
  cancelOrder,
  createPaymentSession,
  getPaymentStatus,
} from "../Controllers/order.controller.js";
import { auth } from "../Middlewares/auth.js";

const router = express.Router();

// Order Management Routes
router.post("/", auth, createOrder);
router.get("/:id", auth, getOrder);
router.get("/", auth, listOrders);
router.post("/:id/cancel", auth, cancelOrder);

// Payment Session Routes (for the new payment flow)
router.post("/:id/payment-session", auth, createPaymentSession);
router.get("/payment/status/:sessionId", auth, getPaymentStatus);

export default router;
