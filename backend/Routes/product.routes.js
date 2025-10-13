import { Router } from "express";
import {
  getAllProducts,
  getProductsByFilter,
  getProductsBySearch,
  getFacets,
  getNewArrivals,
  getFeatured,
  getTrending,
  getProductDetails,
  getVariantByKey,
  trackClick,
} from "../Controllers/products.controller.js";

const router = Router();

router.get("/all", getAllProducts);
router.get("/filter", getProductsByFilter);
router.get("/search", getProductsBySearch);
router.get("/facets", getFacets);
router.get("/new", getNewArrivals);
router.get("/featured", getFeatured);
router.get("/trending", getTrending);
router.get("/:idOrSlug", getProductDetails);
router.get("/lookup", getVariantByKey);
router.post("/:id/track-click", trackClick);

export default router;
