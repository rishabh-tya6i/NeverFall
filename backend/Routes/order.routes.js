import express from "express";
import {
  createOrder,
  getOrder,
  listOrders,
} from "../Controllers/order.controller.js";
import { auth } from "../Middlewares/auth.js";

const router = express.Router();

router.post("/", auth, createOrder);
router.get("/:id", auth, getOrder);
router.get("/", auth, listOrders);

export default router;
