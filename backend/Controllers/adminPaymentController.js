import PaymentGatewayConfig from "../Models/PaymentGatewayConfig.js";
export const validateAndSetGateway = async (req, res) => {
  const { gateway } = req.body;
  if (!["razorpay", "payu", "none"].includes(gateway))
    return res.status(400).json({ ok: false, error: "invalid gateway" });

  if (
    gateway === "razorpay" &&
    (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
  )
    return res
      .status(400)
      .json({ ok: false, error: "Razorpay keys missing on server" });

  if (gateway === "payu" && (!process.env.PAYU_KEY || !process.env.PAYU_SALT))
    return res
      .status(400)
      .json({ ok: false, error: "PayU keys missing on server" });

  const cfg = await PaymentGatewayConfig.findOneAndUpdate(
    {},
    { activeGateway: gateway },
    { new: true, upsert: true }
  );
  return res.json({ ok: true, activeGateway: cfg.activeGateway });
};
