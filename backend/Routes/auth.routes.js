// routes/auth.routes.js
import { Router } from "express";
import { auth } from "../Middlewares/auth.js";
import {
  requestOtp,
  verifyOtpByMobile,
  me,
  logout,
  requestOTPByEmail,
  verifyOtpByEmail,
} from "../Controllers/auth.controller.js";

const router = Router();
router.post("/otp/request/mobile", requestOtp);
router.post("/otp/verify/mobile", verifyOtpByMobile);
router.post("/otp/request/email", requestOTPByEmail);
router.post("/otp/verify/email", verifyOtpByEmail);
router.get("/me", auth, me);
router.post("/logout", logout);

export default router;
