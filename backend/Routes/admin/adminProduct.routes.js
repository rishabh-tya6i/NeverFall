import { Router } from "express";
import { auth, isAdmin } from "../../Middlewares/auth.js";
import { upload } from "../../Middlewares/upload.js";
import {
  getAllProductsAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
  bulkUpdateStock,
  getAllParentProducts,
} from "../../Controllers/admin/adminProduct.controller.js";

const router = Router();

router.use(auth, isAdmin);

router.get("/", getAllProductsAdmin);
router.get("/parents", getAllParentProducts);
router.post("/", upload.fields([{ name: 'coverImage', maxCount: 1 }, { name: 'imageFiles', maxCount: 5 }]), createProduct);
router.put("/:id", upload.fields([{ name: 'coverImage', maxCount: 1 }, { name: 'imageFiles', maxCount: 5 }]), updateProduct);
router.delete("/:id", deleteProduct);
router.patch("/:variantId/stock", updateStock);
router.post("/stock/bulk", bulkUpdateStock);

export default router;