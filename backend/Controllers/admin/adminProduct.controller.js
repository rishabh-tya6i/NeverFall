import mongoose from "mongoose";
import Product from "../../Models/Product.js";
import ParentProduct from "../../Models/ParentProduct.js";
import ProductVariant from "../../Models/ProductVariant.js";
import { cacheDelPattern } from "../../lib/cache.js";
import Category from "../../Models/Category.js";

console.log("Using cacheDelPattern");

const toNum = (v, d) => (v !== undefined && v !== null ? Number(v) : d);
//for normalizing provided slug
function normalizeSlug(s) {
  if (!s) return "";
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // remove invalid chars
    .replace(/\s+/g, "-") // collapse whitespace to -
    .replace(/-+/g, "-") // collapse multiple dashes
    .replace(/^-+|-+$/g, ""); // trim leading/trailing dashes
}

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
    await Promise.all(keysToDelete.map((key) => cacheDelPattern(key + "*")));
    console.log(`Cache cleared for product ${productId}`);
  } catch (error) {
    console.error(`Error clearing cache for product ${productId}:`, error);
  }
};

/* =============================================================
   ADMIN: Product Management
============================================================= */

/**
Create a parent project so that now products can be added into that
 */

export const createParentProduct = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const payload = req.body?.data || req.body || {};
    const {
      title,
      slug: rawSlug,
      description = "",
      details = {},
      tags = [],
      categories = null,
      CollectionType = null,
    } = payload;

    if (!title) {
      return res.status(400).json({ message: "title is required" });
    }

    const slug = normalizeSlug(rawSlug || title);

    // validate category if provided (schema expects a single ObjectId ref "Category")
    let categoryId = null;
    if (categories) {
      if (!mongoose.isValidObjectId(categories)) {
        return res.status(400).json({ message: "Invalid category id" });
      }
      // ensure category exists
      const categoryExists = await Category.findById(categories).lean();
      if (!categoryExists) {
        return res
          .status(400)
          .json({ message: "Referenced category not found" });
      }
      categoryId = categories;
    }

    // check slug uniqueness
    const existing = await ParentProduct.findOne({ slug }).lean();
    if (existing) {
      return res
        .status(409)
        .json({
          message: "A parent product with this slug already exists",
          parent: existing,
        });
    }

    let createdParent = null;
    await session.withTransaction(async () => {
      const parent = new ParentProduct({
        title: title.trim(),
        slug,
        description,
        details,
        tags: Array.isArray(tags) ? tags : [tags],
        categories: categoryId,
        CollectionType: CollectionType || undefined,
      });

      const saved = await parent.save({ session });
      createdParent = saved;
    });

    // return created parent
    res
      .status(201)
      .json({ message: "Parent product created", parent: createdParent });
  } catch (err) {
    console.error("createParentProduct error:", err);
    res
      .status(500)
      .json({ message: "Failed to create parent product", error: err.message });
  } finally {
    session.endSession();
  }
};
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
  console.log('req.body', req.body);
  console.log('req.files', req.files);
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      parent,
      title,
      slug,
      description,
      tags,
      color,
      colorLabel,
      variants,
      images, // Now expecting [{url, alt}]
      collections,
      primaryCategoryId,
      isTrending,
    } = req.body;

    const coverImage = req.files.coverImage ? req.files.coverImage[0].path : '';
    const imageFiles = req.files.imageFiles ? req.files.imageFiles.map(file => ({ url: file.path, alt: '' })) : [];

    // Validation
    if (!title || !slug || !color || !colorLabel || !coverImage) {
      throw new Error("Title, slug, color, colorLabel, and coverImage are required");
    }

    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      throw new Error("At least one variant is required");
    }

    // Validate and process images - ensure they have url and alt
    const imageArray = Array.isArray(images)
      ? images
          .filter(img => img && img.url && typeof img.url === 'string' && img.url.trim().length > 0)
          .map(img => ({
            url: img.url.trim(),
            alt: img.alt || '',
          }))
      : [];

    const finalImages = [...imageArray, ...imageFiles];

    // Validate collections
    const collectionsArray = Array.isArray(collections)
      ? collections.filter(c => c && typeof c === 'string' && c.trim().length > 0)
      : [];

    let parentProduct;
    if (parent) {
      parentProduct = await ParentProduct.findById(parent).session(session);
      if (!parentProduct) {
        throw new Error("Specified parent product not found.");
      }
    } else {
      const tagArray = Array.isArray(tags)
        ? tags.filter(tag => tag && typeof tag === 'string' && tag.trim().length > 0)
        : [];

      parentProduct = new ParentProduct({
        title,
        slug: normalizeSlug(slug),
        description: description || '',
        tags: tagArray,
        categories: primaryCategoryId || null,
      });
      await parentProduct.save({ session });
    }

    // Validate and process variants
    const validVariants = variants.filter(v =>
      v.size && v.sku && v.price !== undefined && v.price !== null
    );

    if (validVariants.length === 0) {
      throw new Error("No valid variants provided");
    }

    const availableSizes = validVariants.map((v) => String(v.size).toUpperCase());
    const priceFrom = Math.min(...validVariants.map((v) => Number(v.price)));
    const compareAtPrices = validVariants
      .filter((v) => v.compareAtPrice && v.compareAtPrice > 0)
      .map((v) => Number(v.compareAtPrice));
    const compareAtFrom = compareAtPrices.length > 0
      ? Math.min(...compareAtPrices)
      : null;

    const productSlug = normalizeSlug(`${slug}-${color}`);

    const newProduct = new Product({
      parent: parentProduct._id,
      title: `${title} - ${colorLabel}`,
      slug: productSlug,
      color: color.toLowerCase(),
      colorLabel,
      images: finalImages,
      coverImage,
      priceFrom,
      compareAtFrom,
      availableSizes,
      inStock: validVariants.some((v) => v.stock > 0),
      collections: collectionsArray,
      primaryCategoryId: primaryCategoryId || null,
      isTrending: isTrending || false,
      publishAt: new Date(),
      currency: 'INR',
      clicks: 0,
      purchases: 0,
    });
    await newProduct.save({ session });

    const variantDocs = validVariants.map((v) => ({
      product: newProduct._id,
      size: String(v.size).toUpperCase(),
      sku: v.sku,
      price: Number(v.price),
      compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : 0,
      stock: Number(v.stock) || 0,
    }));

    await ProductVariant.insertMany(variantDocs, { session });

    await session.commitTransaction();

    res.status(201).json({
      message: "Product created successfully",
      product: newProduct
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Create product error:', error);
    res.status(400).json({
      message: "Failed to create product",
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

export const updateProduct = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid product ID" });
  }

  try {
    const updateData = { ...req.body };

    if (req.files.coverImage) {
      updateData.coverImage = req.files.coverImage[0].path;
    }

    if (req.files.imageFiles) {
      const newImages = req.files.imageFiles.map(file => ({ url: file.path, alt: '' }));
      updateData.images = [...(updateData.images || []), ...newImages];
    }

    // Validate and sanitize images if provided
    if (updateData.images !== undefined) {
      updateData.images = Array.isArray(updateData.images)
        ? updateData.images
            .filter(img => img && img.url && typeof img.url === 'string' && img.url.trim().length > 0)
            .map(img => ({
              url: img.url.trim(),
              alt: img.alt || '',
            }))
        : [];
    }

    // Validate collections
    if (updateData.collections !== undefined) {
      updateData.collections = Array.isArray(updateData.collections)
        ? updateData.collections.filter(c => c && typeof c === 'string' && c.trim().length > 0)
        : [];
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    await clearProductCache(id);

    res.json({
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(400).json({
      message: "Failed to update product",
      error: error.message
    });
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
    const remainingProducts = await Product.countDocuments({
      parent: product.parent,
    }).session(session);
    if (remainingProducts === 0) {
      await ParentProduct.findByIdAndDelete(product.parent).session(session);
    }

    await session.commitTransaction();
    await clearProductCache(id);
    res.json({ message: "Product and its variants deleted successfully." });
  } catch (error) {
    await session.abortTransaction();
    res
      .status(400)
      .json({ message: "Failed to delete product", error: error.message });
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
    const variantsForProduct = await ProductVariant.find({
      product: variant.product,
    });
    const productInStock = variantsForProduct.some((v) => v.stock > 0);
    await Product.findByIdAndUpdate(variant.product, {
      inStock: productInStock,
    });

    await clearProductCache(variant.product.toString());

    res.json({ message: "Stock updated successfully", variant });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating stock", error: error.message });
  }
};

/**
 * POST /api/admin/products/stock/bulk
 * Bulk update stock for multiple variants.
 */
export const bulkUpdateStock = async (req, res) => {
  const { updates } = req.body; // Expecting [{ variantId, stock }]

  if (!Array.isArray(updates) || updates.length === 0) {
    return res
      .status(400)
      .json({ message: "Invalid request body for bulk stock update." });
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
        (
          await ProductVariant.find({
            _id: { $in: updates.map((u) => u.variantId) },
          })
            .select("product")
            .lean()
        ).map((v) => v.product.toString())
      ),
    ];

    for (const productId of productIds) {
      const variants = await ProductVariant.find({
        product: productId,
      }).session(session);
      const productInStock = variants.some((v) => v.stock > 0);
      await Product.findByIdAndUpdate(
        productId,
        { inStock: productInStock },
        { session }
      );
      await clearProductCache(productId);
    }

    await session.commitTransaction();
    res.json({ message: "Bulk stock update successful", result });
  } catch (error) {
    await session.abortTransaction();
    res
      .status(500)
      .json({ message: "Bulk stock update failed", error: error.message });
  } finally {
    session.endSession();
  }
};

export const getAllParentProducts = async (req, res) => {
  try {
    const parentProducts = await ParentProduct.find({}).lean();
    res.json({
      items: parentProducts,
      total: parentProducts.length,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching parent products", error });
  }
};