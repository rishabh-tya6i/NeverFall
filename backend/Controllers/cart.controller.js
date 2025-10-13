import Cart from "../Models/Cart.js";
import ProductVariant from "../Models/ProductVariant.js";
import ParentProduct from "../Models/ParentProduct.js";
import Product from "../Models/Product.js";
import { cacheGet, cacheSet, cacheDelPattern } from "../lib/cache.js";

const CART_TTL = 120;

const calculateCartTotal = (items) =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0);

export const getCart = async (req, res) => {
  const { userId } = req.params;
  const cacheKey = `cart:${userId}`;

  const cached = await cacheGet(cacheKey);
  if (cached) return res.json(cached);

  const cart = await Cart.findOne({ user: userId })
    .populate("items.product items.variant")
    .lean();

  if (!cart) return res.json({ items: [], totalValue: 0 });

  await cacheSet(cacheKey, cart, CART_TTL);
  res.json(cart);
};

// Add to Cart (also used for + button)
export const addToCart = async (req, res) => {
  const { userId, variantId, quantity = 1 } = req.body;

  if (quantity <= 0)
    return res.status(400).json({ message: "Invalid quantity" });

  const variant = await ProductVariant.findById(variantId).populate("product");
  console.log("variant is", variant);
  if (!variant) return res.status(404).json({ message: "Variant not found" });
  if (variant.stock < quantity)
    return res.status(400).json({ message: "Insufficient stock" });

  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = new Cart({ user: userId, items: [] });

  const itemIndex = cart.items.findIndex(
    (i) => i.variant.toString() === variantId
  );

  if (itemIndex > -1) {
    if (variant.stock < cart.items[itemIndex].quantity + quantity)
      return res.status(400).json({ message: "Insufficient stock" });
    cart.items[itemIndex].quantity += quantity;
  } else {
    cart.items.push({
      product: variant.product._id,
      variant: variant._id,
      title: variant.product.title,
      color: variant.product.color,
      size: variant.size,
      price: variant.price,
      quantity,
    });
  }

  cart.totalValue = calculateCartTotal(cart.items);
  await cart.save();

  await cacheDelPattern(`cart:${userId}`);
  await cacheSet(`cart:${userId}`, cart, CART_TTL);

  res.json(cart);
};

// Remove from Cart (decrement quantity)
export const removeFromCart = async (req, res) => {
  const { userId, variantId, size } = req.body;

  const cart = await Cart.findOne({ user: userId });
  if (!cart) return res.status(404).json({ message: "Cart not found" });

  const itemIndex = cart.items.findIndex(
    (i) => i.variant.toString() === variantId
  );
  if (itemIndex === -1)
    return res.status(404).json({ message: "Item not in cart" });

  if (cart.items[itemIndex].quantity > 1) {
    cart.items[itemIndex].quantity -= 1;
  } else {
    cart.items.splice(itemIndex, 1); // Remove completely if quantity reaches 0
  }

  cart.totalValue = calculateCartTotal(cart.items);
  await cart.save();

  await cacheDelPattern(`cart:${userId}`);
  await cacheSet(`cart:${userId}`, cart, CART_TTL);

  res.json(cart);
};

export const deleteFromCart = async (req, res) => {
  const { userId, variantId } = req.body;

  const cart = await Cart.findOne({ user: userId });
  if (!cart) return res.status(404).json({ message: "Cart not found" });

  cart.items = cart.items.filter((i) => !(i.variant.toString() === variantId));

  cart.totalValue = calculateCartTotal(cart.items);
  await cart.save();

  await cacheDelPattern(`cart:${userId}`);
  await cacheSet(`cart:${userId}`, cart, CART_TTL);

  res.json(cart);
};
