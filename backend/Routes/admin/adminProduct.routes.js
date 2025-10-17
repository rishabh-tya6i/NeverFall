import { Router } from "express";
import { auth, isAdmin } from "../../Middlewares/auth.js";
import {
  getAllProductsAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
  bulkUpdateStock,
} from "../../Controllers/admin/adminProduct.controller.js";

const router = Router();

router.use(auth, isAdmin);

router.get("/", getAllProductsAdmin);
router.post("/", createProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);
router.patch("/:variantId/stock", updateStock);
router.post("/stock/bulk", bulkUpdateStock);

export default router;