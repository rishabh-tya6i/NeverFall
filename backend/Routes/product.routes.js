import express from "express";
import {
  getColorVariantFeed,
  getAllProducts,
  getProductsByFilter,
  getProductsBySearch,
  getRecommendations,
  getFacets,
  getNewArrivals,
  getFeatured,
  getTrending,
  getProductDetails,
  getVariantByKey,
  trackClick,
  GetAllCategories,
} from "../Controllers/products.controller.js";
import { auth } from "../Middlewares/auth.js";

const router = express.Router();

/* -------------------------------------------------------------
   PRODUCT FEEDS & LISTS
------------------------------------------------------------- */

// Color feed (homepage feed by color variants)
router.get("/color-feed", getColorVariantFeed);

// All products (cursor-based)
router.get("/all", getAllProducts);

// Products by filter (color, size, price, tags)
router.get("/filter", getProductsByFilter);

// Products by search query
router.get("/search", getProductsBySearch);

// Product facets (available colors, sizes, tags, publish range)
router.get("/facets", getFacets);

// New arrivals
router.get("/new-arrivals", getNewArrivals);

// Featured products
router.get("/featured", getFeatured);

// Trending products
router.get("/trending", getTrending);

//Recommended Products
router.get("/recommended", auth, getRecommendations);

//Get all categories
router.get("/getAllCategories", GetAllCategories);

/* -------------------------------------------------------------
   PRODUCT DETAILS
------------------------------------------------------------- */

// Get single product details by ID or slug
router.get("/:idOrSlug", getProductDetails);

// Get variant by SKU or productId + size
router.get("/variant/lookup", getVariantByKey);

// Track a click explicitly (optional)
router.post("/:id/track-click", trackClick);

/* -------------------------------------------------------------
   PAYMENT GATEWAY CONFIG (admin only)
------------------------------------------------------------- */
// router.post("/gateway/set", auth, validateAndSetGateway);

export default router;
