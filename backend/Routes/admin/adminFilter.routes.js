// routes/adminFilters.routes.js
import express from "express";
import * as adminCtl from "../../Controllers/admin/adminFilter.controller.js";
import { isAdmin } from "../../Middlewares/auth.js"; // implement this

const router = express.Router();

router.get("/admin/filters", isAdmin, adminCtl.listConfigs);
router.get(
  "/admin/categories/:categoryId/filter-config",
  isAdmin,
  adminCtl.getConfig
);
router.post(
  "/admin/categories/:categoryId/filter-config",
  isAdmin,
  adminCtl.createOrUpdateConfig
);
router.patch(
  "/admin/categories/:categoryId/filter-config",
  isAdmin,
  adminCtl.createOrUpdateConfig
);
router.delete(
  "/admin/categories/:categoryId/filter-config",
  isAdmin,
  adminCtl.deleteConfig
);

export default router;
