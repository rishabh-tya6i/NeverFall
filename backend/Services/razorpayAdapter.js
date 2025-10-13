// services/payments/razorpayAdapter.js
import Razorpay from "razorpay";
import crypto from "crypto";

export default function createRazorpayAdapter({ key_id, key_secret }) {
  const instance = new Razorpay({ key_id, key_secret });

  return {
    name: "razorpay",

    async createOrder({ amount, currency = "INR", receipt }) {
      const options = { amount: amount * 100, currency, receipt };
      const order = await instance.orders.create(options);
      return order;
    },

    verifyPayment({ orderId, paymentId, signature }) {
      const expected = crypto
        .createHmac("sha256", key_secret)
        .update(orderId + "|" + paymentId)
        .digest("hex");

      return expected === signature;
    },

    async refundPayment(paymentId, amount) {
      const refund = await instance.payments.refund(paymentId, { amount });
      return refund;
    },
  };
}
