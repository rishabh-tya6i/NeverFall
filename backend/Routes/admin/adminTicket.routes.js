import { Router } from "express";
import { auth, isSupport } from "../../Middlewares/auth.js";
import {
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicketStatus,
  assignTicket,
  addTicketMessage,
  updateTicketPriority,
  getTicketAnalytics,
} from "../../Controllers/admin/adminTicket.controller.js";

const router = Router();

router.use(auth, isSupport);

router.get("/", getAllTickets);
router.get("/analytics", getTicketAnalytics);
router.get("/:id", getTicketById);
router.post("/", createTicket);
router.patch("/:id/status", updateTicketStatus);
router.patch("/:id/assign", assignTicket);
router.post("/:id/messages", addTicketMessage);
router.patch("/:id/priority", updateTicketPriority);

export default router;