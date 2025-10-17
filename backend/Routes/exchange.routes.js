// routes/exchange.routes.js
import express from "express";
import {
  createExchange,
  qcHandler,
  confirmPaymentAndPlaceOrder,
  // Optional controllers if implemented
  // listExchanges,
  // getExchangeDetails,
  // cancelRequestedExchange
} from "../Controllers/exchange.controller.js";
import { auth, isAdmin } from "../Middlewares/auth.js"; // assuming you have auth middleware

const router = express.Router();

/**
 * User routes
 */
router.post(
  "/create",
  auth, // user must be logged in
  createExchange
);

router.post(
  "/confirm-payment",
  auth, // user or admin depending on flow
  confirmPaymentAndPlaceOrder
);

/**
 * Admin / QC routes
 */
router.post(
  "/qc",
  isAdmin, // only admin/QC personnel
  qcHandler
);

// Optional future routes
// router.get("/", isAdmin, listExchanges);
// router.get("/:exchangeId", isAdmin, getExchangeDetails);
// router.post("/:exchangeId/cancel", isAdmin, cancelRequestedExchange);

export default router;
