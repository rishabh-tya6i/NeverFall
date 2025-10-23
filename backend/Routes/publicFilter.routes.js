// routes/public.routes.js (or add to your existing public router)
import express from "express";
import { getFiltersForCategoryPublic } from "../Controllers/publicFilter.controller.js";

const router = express.Router();

// public endpoint - no auth
router.get("/categories/:categoryId/filters", getFiltersForCategoryPublic);

export default router;
