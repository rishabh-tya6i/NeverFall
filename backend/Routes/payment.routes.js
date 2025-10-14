import express from "express";
import { paymentWebhook } from "../Controllers/order.controller.js";

const router = express.Router();

// Webhook endpoints (no authentication required)
router.post("/webhook/razorpay", paymentWebhook);
router.post("/webhook/payu", paymentWebhook);

export default router;
