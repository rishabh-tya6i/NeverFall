// routes/return.routes.js
import express from "express";
import returnController from "../Controllers/return.controller.js";
import { auth, isAdmin } from "../Middlewares/auth.js";
import { cancelReturnRequest } from "../Controllers/return.controller.js";

const router = express.Router();

/**
 * User routes
 */
// Create a new return request
router.post(
  "/create",
  isAdmin, // logged-in users only
  returnController.createReturnRequest
);

// Cancel a return request
router.post("/:id/cancel", auth, cancelReturnRequest);

// List all returns for current user (pagination optional)
router.get("/my-returns", auth, returnController.listReturnsForUser);

// Get a single return by ID
router.get("/:id", auth, returnController.getReturn);

/**
 * Admin routes
 */
// Approve a return and optionally schedule pickup
router.post(
  "/:id/approve",
  isAdmin, // admin-only
  returnController.adminApproveReturn
);

// Mark return received and process refund
router.post(
  "/:id/receive",
  isAdmin, // admin-only
  returnController.adminReceiveAndProcessRefund
);

export default router;
