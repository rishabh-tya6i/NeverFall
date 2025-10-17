import mongoose from "mongoose";
import Product from "../../Models/Product.js";
import ParentProduct from "../../Models/ParentProduct.js";
import ProductVariant from "../../Models/ProductVariant.js";
import { cacheDelPattern } from "../../lib/cache.js";

console.log('Using cacheDelPattern');

const toNum = (v, d) => (v !== undefined && v !== null ? Number(v) : d);

// Invalidate Redis cache for public-facing product routes
const clearProductCache = async (productId) => {
  if (!productId) return;
  try {
    const product = await Product.findById(productId).lean();
    if (!product) return;

    const keysToDelete = [
      `prd:all`,
      `prd:filter`,
      `prd:search`,
      `prd:facets`,
      `prd:new`,
      `prd:feat`,
      `prd:trending`,
      `prd:detail:${productId}`,
      `prd:detail:${product.slug}`,
    ];
    // This is a simplified example. A more robust solution would involve
    // pattern-based deletion if your cache library supports it (e.g., Redis SCAN + DEL).
    await Promise.all(keysToDelete.map(key => cacheDelPattern(key + '*')));
    console.log(`Cache cleared for product ${productId}`);
  } catch (error) {
    console.error(`Error clearing cache for product ${productId}:`, error);
  }
};


/* =============================================================
   ADMIN: Product Management
============================================================= */

/**
 * GET /api/admin/products
 * Get all products for the admin panel, with pagination.
 */
export const getAllProductsAdmin = async (req, res) => {
  try {
    const page = Math.max(1, toNum(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, toNum(req.query.limit, 20)));
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find()
        .populate("parent")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(),
    ]);

    res.json({
      items: products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching products", error });
  }
};

/**
 * POST /api/admin/products
 * Create a new product (parent, color-level product, and variants).
 * This is a complex operation and should be transactional.
 */
export const createProduct = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      parent, // parentId (optional, if adding color to existing)
      title,
      slug,
      description,
      tags,
      categories,
      color,
      colorLabel,
      variants, // [{ size, sku, price, compareAtPrice, stock }]
      images,
      coverImage,
    } = req.body;

    let parentProduct;
    if (parent) {
      parentProduct = await ParentProduct.findById(parent).session(session);
      if (!parentProduct) {
        throw new Error("Specified parent product not found.");
      }
    } else {
      if (!slug) throw new Error("Slug is required for a new parent product.");
      parentProduct = new ParentProduct({ title, slug, description, tags, categories });
      await parentProduct.save({ session });
    }

    const availableSizes = variants.map(v => v.size.toUpperCase());
    const priceFrom = Math.min(...variants.map(v => v.price));
    const compareAtFrom = Math.min(...variants.filter(v => v.compareAtPrice).map(v => v.compareAtPrice));

    const newProduct = new Product({
      parent: parentProduct._id,
      title: `${title} - ${colorLabel}`,
      slug: `${slug}-${color}`,
      color,
      colorLabel,
      images,
      coverImage,
      priceFrom,
      compareAtFrom: compareAtFrom === Infinity ? null : compareAtFrom,
      availableSizes,
      inStock: variants.some(v => v.stock > 0),
      publishAt: new Date(),
    });
    await newProduct.save({ session });

    const variantDocs = variants.map(v => ({
      product: newProduct._id,
      size: v.size.toUpperCase(),
      sku: v.sku,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      stock: v.stock,
    }));

    await ProductVariant.insertMany(variantDocs, { session });

    await session.commitTransaction();
    res.status(201).json({ message: "Product created successfully", product: newProduct });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ message: "Failed to create product", error: error.message });
  } finally {
    session.endSession();
  }
};

/**
 * PUT /api/admin/products/:id
 * Update a product's details.
 */
export const updateProduct = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid product ID" });
  }

  try {
    const updatedProduct = await Product.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    await clearProductCache(id);

    res.json({ message: "Product updated successfully", product: updatedProduct });
  } catch (error) {
    res.status(400).json({ message: "Failed to update product", error: error.message });
  }
};

/**
 * DELETE /api/admin/products/:id
 * Delete a product and its variants.
 */
export const deleteProduct = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid product ID" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const product = await Product.findById(id).session(session);
    if (!product) {
      throw new Error("Product not found");
    }

    await ProductVariant.deleteMany({ product: id }).session(session);
    await Product.findByIdAndDelete(id).session(session);

    // Optional: Check if the parent has any other products. If not, delete parent.
    const remainingProducts = await Product.countDocuments({ parent: product.parent }).session(session);
    if (remainingProducts === 0) {
      await ParentProduct.findByIdAndDelete(product.parent).session(session);
    }

    await session.commitTransaction();
    await clearProductCache(id);
    res.json({ message: "Product and its variants deleted successfully." });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ message: "Failed to delete product", error: error.message });
  } finally {
    session.endSession();
  }
};

/**
 * PATCH /api/admin/products/:variantId/stock
 * Update stock for a single variant.
 */
export const updateStock = async (req, res) => {
  const { variantId } = req.params;
  const { stock } = req.body;

  if (stock === undefined || stock === null) {
    return res.status(400).json({ message: "Stock value is required." });
  }
  if (!mongoose.isValidObjectId(variantId)) {
    return res.status(400).json({ message: "Invalid variant ID" });
  }

  try {
    const variant = await ProductVariant.findByIdAndUpdate(
      variantId,
      { $set: { stock: toNum(stock, 0) } },
      { new: true }
    );

    if (!variant) {
      return res.status(404).json({ message: "Product variant not found" });
    }

    // After updating stock, we must update the parent Product's `inStock` status.
    const variantsForProduct = await ProductVariant.find({ product: variant.product });
    const productInStock = variantsForProduct.some(v => v.stock > 0);
    await Product.findByIdAndUpdate(variant.product, { inStock: productInStock });
    
    await clearProductCache(variant.product.toString());

    res.json({ message: "Stock updated successfully", variant });
  } catch (error) {
    res.status(500).json({ message: "Error updating stock", error: error.message });
  }
};

/**
 * POST /api/admin/products/stock/bulk
 * Bulk update stock for multiple variants.
 */
export const bulkUpdateStock = async (req, res) => {
  const { updates } = req.body; // Expecting [{ variantId, stock }]

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ message: "Invalid request body for bulk stock update." });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const operations = updates.map(({ variantId, stock }) => ({
      updateOne: {
        filter: { _id: variantId },
        update: { $set: { stock: toNum(stock, 0) } },
      },
    }));

    const result = await ProductVariant.bulkWrite(operations, { session });

    // After bulk update, we need to resync the `inStock` status for all affected products.
    const productIds = [
      ...new Set(
        (await ProductVariant.find({ _id: { $in: updates.map(u => u.variantId) } }).select('product').lean())
        .map(v => v.product.toString())
      )
    ];

    for (const productId of productIds) {
      const variants = await ProductVariant.find({ product: productId }).session(session);
      const productInStock = variants.some(v => v.stock > 0);
      await Product.findByIdAndUpdate(productId, { inStock: productInStock }, { session });
      await clearProductCache(productId);
    }

    await session.commitTransaction();
    res.json({ message: "Bulk stock update successful", result });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: "Bulk stock update failed", error: error.message });
  } finally {
    session.endSession();
  }
};
