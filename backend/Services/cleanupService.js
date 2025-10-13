import cron from "node-cron";
import { cleanupExpiredReservations } from "../controllers/orderController.js";
import logger from "../utils/logger.js";

// Run every 5 minutes to clean up expired reservations
cron.schedule("*/5 * * * *", async () => {
  try {
    logger.info("Running reservation cleanup job");
    const result = await cleanupExpiredReservations();
    logger.info("Reservation cleanup completed", result);
  } catch (error) {
    logger.error("Reservation cleanup job failed", { error: error.message });
  }
});

// Run every hour to clean up expired pending orders
cron.schedule("0 * * * *", async () => {
  try {
    const expiredOrders = await Order.deleteMany({
      status: "pending",
      expireAt: { $lt: new Date() },
    });
    logger.info("Expired orders cleaned up", {
      deletedCount: expiredOrders.deletedCount,
    });
  } catch (error) {
    logger.error("Expired orders cleanup failed", { error: error.message });
  }
});
