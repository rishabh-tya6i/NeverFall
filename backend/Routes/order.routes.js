import express from "express";
import {
  createOrder,
  getOrder,
  listOrders,
  cancelOrder,
  createPaymentSession,
  checkPaymentStatus,
} from "../Controllers/order.controller.js";
import { auth } from "../Middlewares/auth.js";

const router = express.Router();

/**
 * --------------------------
 * ORDER MANAGEMENT ROUTES
 * --------------------------
 */

// Create a new order
// POST /api/orders
router.post("/", auth, createOrder);

// Get a single order by ID
// GET /api/orders/:id
router.get("/:id", auth, getOrder);

// Get all orders of the authenticated user
// GET /api/orders
router.get("/", auth, listOrders);

// Cancel an order
// POST /api/orders/:id/cancel
router.post("/:id/cancel", auth, cancelOrder);

/**
 * --------------------------
 * PAYMENT ROUTES
 * --------------------------
 */

// Create a payment session for an order (Razorpay/PayU/COD/Wallet)
// POST /api/orders/:id/payment-session
router.post("/:id/payment-session", auth, createPaymentSession);

// Get payment status by session ID
// GET /api/orders/payment/status/:sessionId
router.get("/payment/status/:sessionId", auth, checkPaymentStatus);

export default router;
