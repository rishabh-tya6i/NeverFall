import User from "../Models/User.js";
import { redis } from "../lib/redis.js";
import { generateOtp, hashOtp } from "../utils/otp.js";
import { generateToken } from "../Middlewares/auth.js";
import { sendEmail } from "../Services/email.service.js";
import { sendSms } from "../Services/phone.service.js";
export async function requestOtp(req, res) {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone required" });

    const ipKey = `otp:rl:ip:${req.ip}`;
    const ipCount = await redis.incr(ipKey);
    if (ipCount === 1) await redis.expire(ipKey, 60);
    if (ipCount > 3)
      return res
        .status(429)
        .json({ error: "Too many requests, try after a minute" });

    const phKey = `otp:rl:phone:${phone}`;
    const phCount = await redis.incr(phKey);
    if (phCount === 1) await redis.expire(phKey, 900);
    if (phCount > 5)
      return res.status(429).json({ error: "OTP limit reached, try later" });

    const blockedKey = `otp:block:${phone}`;
    if (await redis.get(blockedKey))
      return res
        .status(429)
        .json({ error: "Temporarily blocked due to failed attempts" });

    let user = await User.findOne({ phone });
    if (!user) user = await User.create({ phone });

    const otp = generateOtp();
    console.log("Generated OTP:", otp); // For testing purposes only
    const dataKey = `otp:data:${phone}`;
    await redis.set(dataKey, hashOtp(otp), "EX", 300);
    await sendSms(phone, otp);
    return res.json({ ok: true, message: "OTP sent" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
}
//router.post("/otp/verify/mobile", verifyOtpByMobile);
export async function verifyOtpByMobile(req, res) {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp)
      return res.status(400).json({ error: "Phone & OTP required" });

    const blockedKey = `otp:block:${phone}`;
    if (await redis.get(blockedKey))
      return res.status(429).json({ error: "Temporarily blocked, try later" });

    const dataKey = `otp:data:${phone}`;
    const storedHash = await redis.get(dataKey);
    if (!storedHash)
      return res.status(400).json({ error: "OTP expired or not requested" });

    const ok = storedHash === hashOtp(otp);
    if (!ok) {
      const attemptsKey = `otp:attempts:${phone}`;
      const attempts = await redis.incr(attemptsKey);
      if (attempts === 1) await redis.expire(attemptsKey, 600);
      if (attempts >= 5) await redis.set(blockedKey, "1", { EX: 600 });
      return res.status(400).json({ error: "Incorrect OTP" });
    }

    await redis.del(dataKey);
    await redis.del(`otp:attempts:${phone}`);

    const user = await User.findOneAndUpdate(
      { phone },
      { $setOnInsert: { phone } },
      { upsert: true, new: true }
    );

    const token = generateToken(user);
    res
      .cookie("token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
      })
      .json({
        token,
        user: { id: user._id, phone: user.phone, role: user.role },
      });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "OTP verify failed" });
  }
}
// router.post("/otp/request/email", requestOTPByEmail);
export async function requestOTPByEmail(req, res) {
  try {
    const { email, phone } = req.body;
    if (!email || !phone)
      return res.status(400).json({ error: "All Fields are required" });
    //send otp to email
    const otp = generateOtp();
    const dataKey = `otp:data:${email}`;
    await redis.set(dataKey, hashOtp(otp), "EX", 300);
    console.log("Generated Email OTP:", otp); 
    await sendEmail(
      email,
      "Welcome to NevrFall , Do not share OTP with anyone",
      `<p>Your OTP is <strong>${otp}</strong>. It is valid for 5 minutes.</p>`
    );

    res.status(200).json({ ok: true, message: "OTP sent to email" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
}

export async function me(req, res) {
  res.json({ user: req.user || null });
}
export async function logout(req, res) {
  res.clearCookie("token");
  res.json({ ok: true });
}
//router.post("/otp/verify/email", verifyOtpByEmail);
export async function verifyOtpByEmail(req, res) {
  try {
    const { email, otp, phone } = req.body;
    if (!email || !otp || !phone)
      return res.status(400).json({ error: "All Fields are required" });

    const blockedKey = `otp:block:${email}`;
    if (await redis.get(blockedKey))
      return res
        .status(429)
        .json({ error: "Temporarily blocked, try after 1 hr" });

    const dataKey = `otp:data:${email}`;
    const storedHash = await redis.get(dataKey);
    if (!storedHash)
      return res.status(400).json({ error: "OTP expired or not requested" });

    const ok = storedHash === hashOtp(otp);
    if (!ok) {
      const attemptsKey = `otp:attempts:${email}`;
      const attempts = await redis.incr(attemptsKey);
      if (attempts === 1) await redis.expire(attemptsKey, 600); // 10 minutes
      if (attempts >= 5) await redis.set(blockedKey, "1", { EX: 600 });
      return res.status(400).json({ error: "Incorrect OTP" });
    }

    await redis.del(dataKey);
    await redis.del(`otp:attempts:${email}`);

    let user = await User.findOne({ phone });
    if (!user) user = await User.create({ phone, email });
    else if (!user.email) {
      user.email = email;
      await user.save();
    }

    const token = generateToken(user);
    res
      .cookie("token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
      })
      .json({
        token,
        user: {
          id: user._id,
          phone: user.phone,
          email: user.email,
          role: user.role,
        },
      });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "OTP verify failed" });
  }
}
