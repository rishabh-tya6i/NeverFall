// controllers/paymentRedirectController.js
import { getActiveGatewayAdapter } from "../Services/gatewayFactory.js";
import PaymentSession from "../Models/PaymentSession.js";
import Order from "../Models/Order.js";
import { redis, cacheDelPattern } from "../utils/redis.js";
import logger from "../utils/logger.js";

/**
 * Redirect user to payment gateway
 */
export const redirectToGateway = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    const paymentSession = await PaymentSession.findOne({
      sessionId,
      user: userId,
    });

    if (!paymentSession) {
      return res.status(404).json({ message: "Payment session not found" });
    }

    if (paymentSession.status !== "active") {
      return res.status(400).json({ message: "Payment session is not active" });
    }

    const order = await Order.findById(paymentSession.order);

    if (!order) return res.status(404).json({ message: "Order not found" });

    const adapter = await getActiveGatewayAdapter(paymentSession.paymentMethod);

    // --- Generate redirect URL ---
    const redirectData = await adapter.getPaymentRedirect({
      orderId: order._id.toString(),
      amount: order.total - (paymentSession.walletAmount || 0),
      currency: "INR",
      sessionId: paymentSession.sessionId,
      userId: userId.toString(),
    });

    // Some gateways return a URL, some return HTML form
    if (redirectData.redirectUrl) {
      res.json({ redirectUrl: redirectData.redirectUrl });
    } else if (redirectData.formHtml) {
      res.send(redirectData.formHtml); // auto-submit HTML form
    } else {
      throw new Error("Invalid gateway redirect data");
    }

    logger.info("Redirecting user to payment gateway", {
      sessionId,
      orderId: order._id,
    });
  } catch (error) {
    logger.error("Payment redirect failed", { error: error.message });
    res.status(400).json({ message: error.message });
  }
};

export default {
  redirectToGateway,
};
