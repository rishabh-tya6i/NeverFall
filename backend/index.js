import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import connectDB from "./Config/db.js";
import authRoutes from "./Routes/auth.routes.js";
import reviewRoutes from "./Routes/review.routes.js";
import productRoutes from "./Routes/product.routes.js";
import cartRoutes from "./Routes/cart.routes.js";
import couponRoutes from "./Routes/coupon.routes.js";
import orderRoutes from "./Routes/order.routes.js";
import paymentRoutes from "./Routes/payment.routes.js";
import deliveryRoutes from "./Routes/delivery.routes.js";
import exchangeRoutes from "./Routes/exchange.routes.js";
import returnRoutes from "./Routes/return.routes.js";
import mediaRoutes from "./Routes/media.routes.js";
import wishlistRoutes from "./Routes/wishlist.routes.js";
import { connectRedis } from "./lib/redis.js";
import publicFilterRoutes from "./Routes/publicFilter.routes.js";
import adminFilterRoutes from "./Routes/admin/adminFilter.routes.js";
import adminRoutes from "./Routes/admin/index.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.set("trust proxy", 1);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const isProd = process.env.PRODUCTION === "true";
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/health", (req, res) =>
  res.json({
    ok: true,
    env: isProd ? "prod" : "dev",
    time: new Date().toISOString(),
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/exchange", exchangeRoutes);
//filter get
app.use("/api/publicFilter", publicFilterRoutes);
app.use("/api/adminFilter", adminFilterRoutes);

app.use("/api/media", mediaRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/return", returnRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/wishlist", wishlistRoutes);

app.use("/api/admin", adminRoutes);

app.use((req, res) => res.status(404).json({ error: "Route not found" }));

app.use((err, req, res, next) => {
  console.error(err);
  const code = err.status || 500;
  res.status(code).json({ error: err.message || "Server error" });
});

const PORT = Number(process.env.PORT || 8080);

(async () => {
  try {
    await connectDB();
    await connectRedis();
    const server = app.listen(PORT, () => {
      console.log(`Server started on PORT ${PORT}`);
    });

    const shutdown = (sig) => () => {
      console.log(`${sig} received. Shutting down...`);
      server.close(() => {
        console.log("HTTP server closed");
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000).unref();
    };

    process.on("SIGINT", shutdown("SIGINT"));
    process.on("SIGTERM", shutdown("SIGTERM"));
  } catch (e) {
    console.error("Startup error:", e);
    process.exit(1);
  }
})();
