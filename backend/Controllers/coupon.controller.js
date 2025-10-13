import Coupon from "../Models/Coupon.js";
import Order from "../Models/Order.js";
import mongoose from "mongoose";

export const createCoupon = async (req, res) => {
  try {
    const {
      code,
      name,
      type,
      value,
      maxDiscountAmount = null,
      maxUses = null,
      maxUsesPerUser = 1,
      targetUser = null,
      applicableProductIds = [],
      applicableCategoryIds = [],
      minOrderValue = 0,
      active = true,
      expiresAt = null,
    } = req.body;

    const createdBy = req.user && req.user._id;
    if (!createdBy)
      return res.status(403).json({ message: "Admin auth required" });

    const coupon = new Coupon({
      code,
      name,
      type,
      value,
      maxDiscountAmount,
      maxUses,
      maxUsesPerUser,
      targetUser: targetUser || null,
      applicableProductIds,
      applicableCategoryIds,
      minOrderValue,
      active,
      expiresAt,
      createdBy,
    });

    await coupon.save();
    res.status(201).json(coupon);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};


export const validateCoupon = async (req, res) => {
  try {
    const { code, userId, items = [] } = req.body;
    if (!code) return res.status(400).json({ message: "coupon code required" });

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon || !coupon.active)
      return res.status(400).json({ message: "Invalid coupon" });

    if (coupon.targetUser && String(coupon.targetUser) !== String(userId)) {
      return res
        .status(400)
        .json({ message: "Coupon is only valid for selected costumers" });
    }

    if (coupon.expiresAt && coupon.expiresAt < new Date())
      return res.status(400).json({ message: "Coupon expired" });

    if (coupon.maxUses && coupon.usesCount >= coupon.maxUses)
      return res.status(400).json({ message: "Coupon usage limit reached" });

    if (coupon.maxUsesPerUser) {
      const userUsage = await Order.countDocuments({
        "coupon.couponId": coupon._id,
        user: userId,
      });
      if (userUsage >= coupon.maxUsesPerUser)
        return res.status(400).json({ message: "Coupon already used by user" });
    }

    // compute totals
    const subtotal = items.reduce(
      (s, it) => s + (it.price || 0) * (it.quantity || 0),
      0
    );

    // check minOrderValue (applies to subtotal of order)
    if ((coupon.minOrderValue || 0) > 0 && subtotal < coupon.minOrderValue) {
      return res.status(400).json({
        message: `Minimum order value of ${coupon.minOrderValue} required to apply this coupon`,
      });
    }

    // compute applicable subtotal (items coupon can discount)
    let applicableSubtotal = 0;
    const applicableProductSet = new Set(
      (coupon.applicableProductIds || []).map(String)
    );
    const applicableCategorySet = new Set(
      (coupon.applicableCategoryIds || []).map(String)
    );

    items.forEach((it) => {
      let applies = true;
      if (
        applicableProductSet.size > 0 &&
        !applicableProductSet.has(String(it.product))
      )
        applies = false;
      // category logic omitted here: if you need it, expand product categories in caller before calling validate.
      if (applies) applicableSubtotal += (it.price || 0) * (it.quantity || 0);
    });

    if (applicableSubtotal <= 0)
      return res
        .status(400)
        .json({ message: "Coupon not applicable to selected items" });

    let discountAmount = 0;
    if (coupon.type === "fixed") {
      discountAmount = Math.min(coupon.value, applicableSubtotal);
    } else {
      discountAmount = (applicableSubtotal * coupon.value) / 100;
      if (coupon.maxDiscountAmount)
        discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
    }

    res.json({
      ok: true,
      discountAmount,
      coupon,
      subtotal,
      applicableSubtotal,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
