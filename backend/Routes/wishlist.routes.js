import express from "express";
import { addToWishlist, getWishlist, removeFromWishlist } from "../Controllers/wishlist.controller.js";
import { auth } from "../Middlewares/auth.js";

const router = express.Router();

router.use(auth);

router.get("/", getWishlist);
router.post("/add", addToWishlist);
router.post("/remove", removeFromWishlist);

export default router;
