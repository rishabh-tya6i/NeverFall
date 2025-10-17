import { Router } from "express";
import { auth, isSupport, isAdmin } from "../../Middlewares/auth.js";
import {
  getAllShipments,
  createShipment,
  updateShipmentStatus,
  trackShipment,
  getShipmentByOrder,
  updateTrackingNumber,
  bulkUpdateShipments,
} from "../../Controllers/admin/adminShipment.controller.js";

const router = Router();

// Support staff can view and track
router.get("/", auth, isSupport, getAllShipments);
router.get("/track/:trackingNumber", auth, isSupport, trackShipment);
router.get("/order/:orderId", auth, isSupport, getShipmentByOrder);

// Admin can create and modify
router.post("/", auth, isAdmin, createShipment);
router.patch("/:id/status", auth, isAdmin, updateShipmentStatus);
router.patch("/:id/tracking", auth, isAdmin, updateTrackingNumber);
router.post("/bulk", auth, isAdmin, bulkUpdateShipments);

export default router;