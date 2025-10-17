// routes/delivery.routes.js
import express from "express";
import {
  dispatchOrder,
  checkPincodeDeliverabilityForDelhivery,
  createPickupRequest,
  cancelShipment,
  generateDeliveryOtp,
  verifyDeliveryOtp,
  delhiveryScanWebhook,
  delhiveryDocWebhook,
  triggerNdr,
  getShipmentStatus,
} from "../Controllers/delivery.controller.js"; // adjust path/casing as needed
import { auth } from "../Middlewares/auth.js"; // your middleware

const router = express.Router();

/**
 * NOTE:
 * - Webhooks (scan/doc) are left public to accept Delhivery POSTs.
 *   In production secure them (HMAC signature, token param) and validate inside controller.
 * - Pincode check is public (used by frontend). If you want it protected, add `auth` before the handler.
 * - OTP endpoints are protected by `auth` here — you can change to allow unauthenticated agent flow if needed.
 */

// Public / frontend
router.get(
  "/delivery/pincode/delhivery",
  checkPincodeDeliverabilityForDelhivery
);

// Admin / internal (requires auth)
router.post("/delivery/dispatch", auth, dispatchOrder); // create manifest + delivery doc
router.post("/delivery/pickup", auth, createPickupRequest); // create pickup request
router.post("/delivery/cancel", auth, cancelShipment); // cancel by waybill
router.post("/delivery/ndr", auth, triggerNdr); // manual NDR action

// Delivery & OTP routes (protected)
router.post("/delivery/:deliveryId/otp/generate", auth, generateDeliveryOtp);
router.post("/delivery/:deliveryId/otp/verify", auth, verifyDeliveryOtp);

// Shipment status (protected). If you want public tracking, make this route public and require only waybill/token.
router.get("/delivery/:deliveryId/status", auth, getShipmentStatus);

// Delhivery webhooks (public). Consider putting behind a raw-body parser route in app if you need raw payload.
router.post("/delivery/webhook/scan", delhiveryScanWebhook);
router.post("/delivery/webhook/doc", delhiveryDocWebhook);

// Export router
export default router;
