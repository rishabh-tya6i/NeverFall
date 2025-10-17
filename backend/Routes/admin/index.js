import { Router } from "express";
import productRoutes from "./adminProduct.routes.js";
import orderRoutes from "./adminOrder.routes.js";
// import ticketRoutes from "./adminTicket.routes.js";
// import shipmentRoutes from "./adminShipment.routes.js";
import paymentRoutes from "./adminPayment.routes.js";
import reviewRoutes from "./adminReview.routes.js";


const router = Router();

router.use("/products", productRoutes);
router.use("/orders", orderRoutes);
// router.use("/tickets", ticketRoutes);
router.use("/reviews", reviewRoutes);
// router.use("/shipments", shipmentRoutes);
router.use("/payments", paymentRoutes);

export default router;