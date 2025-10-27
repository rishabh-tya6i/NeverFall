// delivery.controller.js
import axios from "axios";
import crypto from "crypto";
import ms from "ms";
import Order from "../Models/Order.js";
import Delivery from "../Models/Delivery.js";
import ReturnRequest from "../Models/ReturnRequest.js";
import ExchangeRequest from "../Models/ExchangeRequest.js";
import User from "../Models/User.js";
import { cacheGet, cacheSet, cacheDel } from "../lib/cache.js";
import { deliveryQueue } from "../Services/delivery.worker.js";
import { redis } from "../lib/redis.js";
import mongoose from "mongoose";
import { sendSms } from "../Services/phone.service.js";
import DelhiveryConfig from "../Models/DelhiveryConfig.js";
import PickupLocation from "../Models/PickupLocation.js";
import PincodeServiceability from "../Models/PincodeServiceability.js";

const OTP_TTL_SECONDS = Number(process.env.OTP_TTL_SECONDS) || 10 * 60; // 10 minutes
const OTP_LENGTH = Number(process.env.OTP_LENGTH) || 6;

// helper: get Delhivery config from DB
const getDelhiveryConfig = async () => {
  const config = await DelhiveryConfig.findOne({ name: "default" });
  if (!config) {
    throw new Error("Delhivery config not found in database");
  }
  return config;
};

// helper: axios instance
export const getDelhiveryInstance = async () => {
  const config = await getDelhiveryConfig();
  return axios.create({
    baseURL: config.isStaging ? config.stagingUrl : config.baseUrl,
    headers: {
      Authorization: `Token ${config.token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    timeout: 30_000,
  });
};

// Real enqueue helper (use job name = type)
const enqueueJob = async (type, payload = {}, opts = {}) => {
  try {
    // Add job with name = type. Data shape: { payload }
    // opts can include jobId, delay, attempts, backoff etc.
    return await deliveryQueue.add(type, { payload }, opts);
  } catch (err) {
    console.error("enqueueJob error", err);
    throw err;
  }
};

// helper: generate numeric OTP
function generateOtp(len = OTP_LENGTH) {
  const max = 10 ** len;
  const n =
    Math.floor(Math.random() * (max - 10 ** (len - 1))) + 10 ** (len - 1);
  return String(n).slice(0, len);
}
function hashOtp(otp, salt = crypto.randomBytes(8).toString("hex")) {
  const h = crypto.createHmac("sha256", salt).update(otp).digest("hex");
  return `${salt}:${h}`;
}
function verifyHashedOtp(otp, hashed) {
  if (!hashed) return false;
  const [salt, h] = String(hashed).split(":");
  if (!salt || !h) return false;
  const check = crypto.createHmac("sha256", salt).update(otp).digest("hex");
  return check === h;
}

// helpers for Delhivery calls (thin wrappers)
async function delhiveryGet(path, params = {}) {
  try {
    const delhivery = await getDelhiveryInstance();
    const resp = await delhivery.get(path, { params });
    return resp.data;
  } catch (err) {
    console.error(
      "[Delhivery GET] error",
      path,
      err.response?.data || err.message
    );
    throw err;
  }
}
async function delhiveryPost(path, body = {}, params = {}) {
  try {
    const delhivery = await getDelhiveryInstance();
    const resp = await delhivery.post(path, body, { params });
    return resp.data;
  } catch (err) {
    console.error(
      "[Delhivery POST] error",
      path,
      err.response?.data || err.message
    );
    throw err;
  }
}
async function delhiveryPut(path, body = {}, params = {}) {
  try {
    const delhivery = await getDelhiveryInstance();
    const resp = await delhivery.put(path, body, { params });
    return resp.data;
  } catch (err) {
    console.error(
      "[Delhivery PUT] error",
      path,
      err.response?.data || err.message
    );
    throw err;
  }
}
// Check pincode deliverability for Delhivery only
// Accepts: req.query.pin or req.body.pin (string/number)
// Response: { ok: true, pin: "110001", deliverable: true|false|null, via: 'cache'|'db'|'delhivery'|'unknown', details: {...} }
export const checkPincodeDeliverabilityForDelhivery = async (req, res) => {
  try {
    const pin = String(req.query.pin || req.body.pin || "").trim();
    if (!pin)
      return res
        .status(400)
        .json({ ok: false, error: "pin (pincode) is required" });

    // Basic validation for Indian PIN (6 digits)
    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid pincode format. Expected 6 digits.",
      });
    }

    const COURIER = "DELHIVERY";
    const cacheKey = `pincode:delhivery:${pin}`;

    // 1) Try cache
    try {
      const cached = await cacheGet(cacheKey);
      if (cached) {
        let parsed = cached;
        try {
          parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
        } catch (e) {
          parsed = cached;
        }
        return res.json({
          ok: true,
          pin,
          deliverable: parsed.deliverable ?? null,
          via: "cache",
          details: parsed.details || null,
        });
      }
    } catch (e) {
      console.warn("cacheGet error for pincode", cacheKey, e.message || e);
    }

    // 2) Try local DB
    try {
      const record = await PincodeServiceability.findOne({
        pincode: pin,
        courier: COURIER,
      });
      if (record) {
        // cache result for 24h
        try {
          await cacheSet(
            cacheKey,
            JSON.stringify({
              deliverable: !!record.deliverable,
              details: record.details || null,
            }),
            86400
          );
        } catch (e) {
          /* ignore cache set failures */
        }

        return res.json({
          ok: true,
          pin,
          deliverable: !!record.deliverable,
          via: "db",
          details: record.details || null,
        });
      }
    } catch (e) {
      console.warn("PincodeServiceability DB check failed", e.message || e);
    }

    // 3) Fallback -> call Delhivery API for serviceability
    const DELHIVERY_PINCODE_PATH =
      process.env.DELHIVERY_PINCODE_PATH || "/api/pincode/check";

    try {
      // Build params - adapt if your Delhivery account expects different param names
      const params = { pin }; // or { pincode: pin } if required by your account
      // Try the API call
      let dlResp = null;
      try {
        dlResp = await delhiveryGet(DELHIVERY_PINCODE_PATH, params);
      } catch (e) {
        // If single path fails, try an alternative common param name
        try {
          dlResp = await delhiveryGet(DELHIVERY_PINCODE_PATH, { pincode: pin });
        } catch (e2) {
          dlResp = null;
        }
      }

      if (dlResp) {
        let deliverable = null;
        let details = dlResp;

        // Interpret common response shapes
        if (typeof dlResp === "object") {
          if (dlResp.serviceable !== undefined)
            deliverable = !!dlResp.serviceable;
          else if (dlResp.deliverable !== undefined)
            deliverable = !!dlResp.deliverable;
          else if (
            dlResp.data &&
            (dlResp.data.serviceable !== undefined ||
              dlResp.data.deliverable !== undefined)
          ) {
            deliverable = !!(
              dlResp.data.serviceable ?? dlResp.data.deliverable
            );
            details = dlResp.data;
          } else if (dlResp.ok === true && dlResp.message) {
            if (/not|no|unavailable/i.test(dlResp.message)) deliverable = false;
            if (/yes|available|supported/i.test(dlResp.message))
              deliverable = true;
          }
        } else if (typeof dlResp === "string") {
          if (/yes|available|supported/i.test(dlResp)) deliverable = true;
          if (/no|not available|unsupported/i.test(dlResp)) deliverable = false;
        }

        // Cache & persist if boolean determined
        if (deliverable !== null) {
          try {
            await cacheSet(
              cacheKey,
              JSON.stringify({ deliverable, details }),
              86400
            );
          } catch (e) {
            /* ignore cache set failures */
          }

          try {
            await PincodeServiceability.updateOne(
              { pincode: pin, courier: COURIER },
              {
                $set: {
                  pincode: pin,
                  courier: COURIER,
                  deliverable,
                  details,
                  updatedAt: new Date(),
                },
              },
              { upsert: true }
            );
          } catch (e) {
            console.warn(
              "persist PincodeServiceability failed",
              e.message || e
            );
          }

          return res.json({
            ok: true,
            pin,
            deliverable,
            via: "delhivery",
            details,
            usedPath: DELHIVERY_PINCODE_PATH,
          });
        }

        // dlResp didn't have interpretable boolean
        return res.json({
          ok: true,
          pin,
          deliverable: null,
          via: "delhivery",
          details,
          note: "Delhivery returned a response but it was not unambiguously parseable. Inspect 'details'.",
          usedPath: DELHIVERY_PINCODE_PATH,
        });
      }
    } catch (e) {
      console.warn("Delhivery pincode check failed", e.message || e);
    }

    // All attempts failed -> unknown
    return res.json({
      ok: true,
      pin,
      deliverable: null,
      via: "unknown",
      note: "Serviceability unknown: no cached/db/delhivery result. Consider adding pin to PincodeServiceability collection.",
    });
  } catch (err) {
    console.error("checkPincodeDeliverabilityForDelhivery err", err);
    return res
      .status(500)
      .json({ ok: false, error: err.message || String(err) });
  }
};

// Small util: extract likely waybill from Delhivery response (adapt to actual shape)
function extractWaybillFromDelhiveryResp(dlResp) {
  if (!dlResp) return null;
  // Common shapes:
  //  - { shipments: [ { waybill: "..." } ] }
  //  - { waybill: "..." }
  const shipments = dlResp.shipments || dlResp.data?.shipments || null;
  if (Array.isArray(shipments) && shipments.length > 0) {
    return (
      shipments[0].waybill ||
      shipments[0].awb ||
      shipments[0].waybill_number ||
      null
    );
  }
  return dlResp.waybill || dlResp.awb || dlResp.awb_no || null;
}

// ---------- Controller functions ----------

// 1) dispatchOrder
export const dispatchOrder = async (req, res) => {
  try {
    const { orderId, preferredWaybill } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: "orderId required" });
    }

    const pickup_location = await PickupLocation.findOne({ isDefault: true });
    if (!pickup_location) {
      return res.status(500).json({ error: "Default pickup location not found" });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) return res.status(404).json({ error: "Order not found" });

    // If order already has deliveryDetails (manifested) - return existing
    if (order.deliveryDetails) {
      const existing = await Delivery.findById(order.deliveryDetails);
      return res.json({
        ok: true,
        alreadyDispatched: true,
        delivery: existing,
      });
    }

    // Build shipments payload: mapping one order -> one shipment (single piece)
    const shipment = {
      name:
        order.shippingAddress?.name ||
        (order.user ? String(order.user) : "Customer"),
      add: order.shippingAddress?.address || order.shippingAddress?.line1 || "",
      pin: order.shippingAddress?.pincode || order.shippingAddress?.pin || "",
      city: order.shippingAddress?.city || "",
      state: order.shippingAddress?.state || "",
      country: order.shippingAddress?.country || "India",
      phone: Array.isArray(order.shippingAddress?.phone)
        ? order.shippingAddress.phone[0]
        : order.shippingAddress?.phone || "",
      order: String(order._id),
      payment_mode: order.paymentMethod === "cod" ? "COD" : "Prepaid",
      weight: order.meta?.shipmentWeight || 200, // grams - replace with real weight
      products_desc:
        order.items
          ?.map((it) => it.title)
          .slice(0, 5)
          .join(", ") || "Products",
      shipment_height: order.meta?.shipmentHeight || "",
      shipment_width: order.meta?.shipmentWidth || "",
      shipment_length: order.meta?.shipmentLength || "",
    };

    // Create local Delivery doc (status pending) - keep minimal fields
    const deliveryDoc = await Delivery.create({
      order: order._id,
      client: order.user,
      status: "created",
      pickup_location: pickup_location.name,
      payment_mode: shipment.payment_mode,
      attemptCount: 0,
      history: [{ status: "created", at: new Date(), note: "Created locally" }],
      meta: { createdBy: req.user?.id || null },
    });

    // persist relation in Order
    await Order.findByIdAndUpdate(order._id, {
      $set: { deliveryDetails: deliveryDoc._id },
    });

    // Prepare Delhivery manifest payload
    const body = {
      pickup_location: { name: pickup_location.name },
      shipments: [shipment],
    };

    // If preferredWaybill provided, pass as waybill
    if (preferredWaybill) body.shipments[0].waybill = preferredWaybill;

    // Enqueue label generation job (worker will call delhiveryAPI.createShipmentLabel if present)
    try {
      await enqueueJob("generateLabel", {
        orderId: String(order._id),
        deliveryId: String(deliveryDoc._id),
      });
    } catch (e) {
      console.warn("enqueue generateLabel failed", e.message);
      // proceed — label generation is best-effort
    }

    let dlResp = null;
    try {
      // Delhivery expects `data` param sometimes as JSON string depending on endpoint; you used /api/cmu/create.json previously
      dlResp = await delhiveryPost("/api/cmu/create.json", {
        data: JSON.stringify(body),
      });
    } catch (err) {
      // rollback or mark delivery as failed
      await Delivery.findByIdAndUpdate(deliveryDoc._id, {
        $set: {
          status: "manifest_failed",
          "meta.delhiveryError": err?.response?.data || err.message,
        },
        $push: {
          history: {
            status: "manifest_failed",
            at: new Date(),
            note: "Delhivery manifest failed",
          },
        },
      });
      console.error(
        "dispatchOrder - delhivery manifest error",
        err.response?.data || err.message || err
      );
      return res
        .status(500)
        .json({ error: err?.response?.data || err.message || String(err) });
    }

    // Extract waybill (if present) and persist response
    const waybill = extractWaybillFromDelhiveryResp(dlResp);

    await Delivery.findByIdAndUpdate(deliveryDoc._id, {
      $set: {
        status: "manifested",
        delhiveryRaw: dlResp,
        waybill: waybill || undefined,
      },
      $push: {
        history: {
          status: "manifested",
          at: new Date(),
          note: "Manifested on Delhivery",
        },
      },
    });

    // Update order status to processing/confirmed
    await Order.findByIdAndUpdate(order._id, {
      $set: { status: "processing" },
    });

    // Optionally enqueue label generation again with deliveryId
    try {
      await enqueueJob("generateLabel", {
        deliveryId: String(deliveryDoc._id),
        orderId: String(order._id),
      });
    } catch (e) {
      // ignore
    }

    return res.json({
      ok: true,
      deliveryId: deliveryDoc._id,
      delhivery: dlResp,
    });
  } catch (err) {
    console.error("dispatchOrder err", err);
    return res
      .status(500)
      .json({ error: err?.response?.data || err.message || String(err) });
  }
};

// 2) createPickupRequest (once multiple shipments ready)
export const createPickupRequest = async (req, res) => {
  try {
    const {
      pickup_date,
      pickup_time,
      pickup_location_name,
      expected_package_count,
    } = req.body;
    if (
      !pickup_date ||
      !pickup_time ||
      !pickup_location_name ||
      !expected_package_count
    ) {
      return res.status(400).json({
        error:
          "pickup_date, pickup_time, pickup_location_name, expected_package_count required",
      });
    }

    const pickup_location = await PickupLocation.findOne({ name: pickup_location_name });
    if (!pickup_location) {
      return res.status(404).json({ error: "Pickup location not found" });
    }

    const body = {
      pickup_time,
      pickup_date,
      pickup_location: pickup_location.name,
      expected_package_count,
    };
    const resp = await delhiveryPost("/fm/request/new/", body);
    // optionally persist pickup resp in a collection
    await mongoose.connection.collection("delhivery_pickups").insertOne({
      request: body,
      resp,
      createdAt: new Date(),
    });
    return res.json({ ok: true, resp });
  } catch (err) {
    console.error("createPickupRequest err", err);
    return res.status(500).json({ error: err?.response?.data || err.message });
  }
};

// 3) cancelShipment
export const cancelShipment = async (req, res) => {
  try {
    const { waybill } = req.body;
    if (!waybill) return res.status(400).json({ error: "waybill required" });
    const body = { waybill, cancellation: "true" };
    const resp = await delhiveryPost("/api/p/edit", body);
    // update local Delivery if mapped
    await Delivery.updateOne(
      {
        $or: [
          { "delhiveryRaw.waybill": waybill },
          { "delhiveryRaw.shipments.waybill": waybill },
          { waybill },
        ],
      },
      {
        $set: { status: "cancelled", "meta.cancelResp": resp },
        $push: {
          history: {
            status: "cancelled",
            at: new Date(),
            note: "Cancelled via API",
          },
        },
      }
    );
    return res.json({ ok: true, resp });
  } catch (err) {
    console.error("cancelShipment err", err);
    return res.status(500).json({ error: err?.response?.data || err.message });
  }
};

// 4) generate OTP for delivery (when dispatched/out_for_delivery)
export const generateDeliveryOtp = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const delivery = await Delivery.findById(deliveryId).populate("order");
    if (!delivery) return res.status(404).json({ error: "Delivery not found" });

    if (["delivered", "rto", "cancelled"].includes(delivery.status)) {
      return res.status(400).json({
        error: `Cannot generate OTP for delivery in '${delivery.status}' state`,
      });
    }

    // Generate OTP (numeric), hash and persist
    const otp = generateOtp(OTP_LENGTH);
    const hashed = hashOtp(otp);
    const now = new Date();

    delivery.otpHash = hashed;
    delivery.otpSentAt = now;
    delivery.otpVerified = false;
    delivery.otpMeta = delivery.otpMeta || {};
    delivery.otpMeta.sentVia = "sms";
    const phone =
      delivery.order?.shippingAddress?.phone ||
      delivery.order?.userPhone ||
      null;
    delivery.otpMeta.sentTo = phone || null;

    await delivery.save();

    // Cache hashed OTP for fast verification (no TTL if cacheDel supports that)
    try {
      // If you want TTL, pass OTP_TTL_SECONDS. Passing null/undefined sets no expiry depending on your cache implementation.
      await cacheSet(`otp:delivery:${delivery._id}`, hashed, OTP_TTL_SECONDS);
    } catch (e) {
      console.warn("Warning: cacheSet failed for otp", e.message);
    }

    // Send SMS via your SMS provider (do not return OTP in production).
    if (phone) {
      try {
        await sendSms(
          phone,
          `Your delivery OTP is ${otp}. Provide this to the delivery agent to confirm delivery.`
        );
      } catch (smsErr) {
        console.warn("sendSms error:", smsErr?.message || smsErr);
      }
    } else {
      console.warn("No phone number found for delivery", delivery._id);
    }

    // Enqueue notification job (for analytics / fallback)
    try {
      await enqueueJob("notifyCustomer", {
        userId: delivery.client,
        deliveryId: String(delivery._id),
      });
    } catch (e) {
      // ignore
    }
    const config = await getDelhiveryConfig();
    // In staging, return otp for testing. In prod do not return.
    if (config.isStaging) return res.json({ ok: true, otpTest: otp, sentAt: now });
    return res.json({
      ok: true,
      message: "OTP generated and sent (if phone available).",
    });
  } catch (err) {
    console.error("generateDeliveryOtp err", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};

// 5) verify OTP (called when agent collects OTP from customer)
export const verifyDeliveryOtp = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const { otp, agentId } = req.body;
    if (!otp) return res.status(400).json({ error: "otp required" });

    const delivery = await Delivery.findById(deliveryId).populate("order");
    if (!delivery) return res.status(404).json({ error: "Delivery not found" });

    if (delivery.otpVerified) {
      return res.json({ ok: true, message: "OTP already verified" });
    }

    // Get hashed from cache or DB
    let hashed = null;
    try {
      hashed = await cacheGet(`otp:delivery:${delivery._id}`);
    } catch (e) {
      console.warn("cacheGet otp error", e.message);
    }
    if (!hashed) hashed = delivery.otpHash;

    if (!hashed) {
      return res
        .status(400)
        .json({ error: "No OTP found for this delivery. Generate a new OTP." });
    }

    // Verify hash
    if (!verifyHashedOtp(otp, hashed)) {
      // record failed attempt for auditing/fraud
      await Delivery.findByIdAndUpdate(deliveryId, {
        $inc: { "meta.failedOtpCount": 1 },
        $push: {
          history: {
            status: "otp_failed",
            at: new Date(),
            note: `Invalid OTP attempt`,
          },
        },
      });
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // Mark as verified and delivered
    delivery.otpVerified = true;
    delivery.history.push({
      status: "otp_verified",
      at: new Date(),
      note: `OTP verified by agent ${agentId || "unknown"}`
    });
    delivery.status = "delivered";
    delivery.deliveredAt = new Date();
    await delivery.save();

    // Update order status
    if (delivery.order)
      await Order.findByIdAndUpdate(delivery.order, {
        $set: { status: "delivered" },
      });

    // Clear cache and sensitive fields using cacheDel; fallback to direct redis del
    try {
      await cacheDel(`otp:delivery:${delivery._id}`);
    } catch (e) {
      try {
        await redis.del(`otp:delivery:${delivery._id}`);
      } catch (e2) {
        /* ignore */
      }
    }

    // Optionally clear delivery.otpHash if you want to permanently remove secret
    await Delivery.findByIdAndUpdate(delivery._id, {
      $unset: { otpHash: "", otpSentAt: "" },
      $set: { otpVerified: true },
    });

    // Enqueue post-delivery processing job
    try {
      await enqueueJob("postDeliveryProcessing", {
        orderId: String(delivery.order),
        deliveryStatus: "delivered",
      });
    } catch (e) {
      // ignore
    }

    return res.json({
      ok: true,
      message: "OTP verified and delivery marked as delivered",
    });
  } catch (err) {
    console.error("verifyDeliveryOtp err", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};

// 6) Delhivery webhook: scan-push (status updates)
export const delhiveryScanWebhook = async (req, res) => {
  try {
    // Immediately reply 200 to acknowledge
    res.status(200).send("OK");

    const payload = req.body;
    // Persist raw webhook for audit
    await mongoose.connection.collection("delhivery_webhooks").insertOne({
      type: "scan_push",
      payload,
      receivedAt: new Date(),
    });

    const waybill =
      payload.waybill ||
      payload.awb ||
      payload.awb_no ||
      payload.awb_number ||
      payload.wbn ||
      payload.waybill_number;
    const status =
      payload.status ||
      payload.status_type ||
      payload.scan_type ||
      payload.scan ||
      payload.type;

    if (!waybill) {
      console.warn(
        "delhiveryScanWebhook: no waybill found in payload",
        payload
      );
      return;
    }

    const delivery = await Delivery.findOne({
      $or: [
        { "delhiveryRaw.waybill": waybill },
        { "delhiveryRaw.shipments.waybill": waybill },
        { waybill },
      ],
    });

    if (!delivery) {
      console.warn(
        "delhiveryScanWebhook: no local delivery for waybill",
        waybill
      );
      return;
    }

    // Map Delhivery statuses to normalized statuses
    const rawStatus = String(status || "");
    let mappedStatus = "in_transit";
    if (/manifested|ud/i.test(rawStatus)) mappedStatus = "manifested";
    if (/picked up|picked_up|picked_up/i.test(rawStatus))
      mappedStatus = "picked_up";
    if (/in transit/i.test(rawStatus) || payload.status_type === "UD")
      mappedStatus = "in_transit";
    if (
      /dispatched|out_for_delivery|out-for-delivery|dispatched/i.test(rawStatus)
    )
      mappedStatus = "out-for-delivery";
    if (/delivered|dl/i.test(rawStatus)) mappedStatus = "delivered";
    if (/dto|rt_o|rto|returned/i.test(rawStatus)) mappedStatus = "rto";
    if (/pending|pt/i.test(rawStatus)) mappedStatus = "pending";
    if (/not picked|ud.*not picked/i.test(rawStatus))
      mappedStatus = "not_picked";

    // push event to history and update status + attempt count if attempted
    const upd = {
      $push: {
        history: { status: mappedStatus, at: new Date(), raw: payload },
      },
    };
    if (mappedStatus === "out-for-delivery")
      upd.$set = { status: "out-for-delivery" };
    if (mappedStatus === "delivered") {
      upd.$set = { status: "delivered", deliveredAt: new Date() };
      // also sync order status
      await Order.findByIdAndUpdate(delivery.order, {
        $set: { status: "delivered" },
      });
    }
    // Attempt detection
    if (
      /attempt|attempted/i.test(rawStatus) ||
      /UD.*Pending/i.test(rawStatus)
    ) {
      upd.$inc = { attemptCount: 1 };
      upd.$set = { status: "attempted" };
      const after = await Delivery.findByIdAndUpdate(delivery._id, upd, {
        new: true,
      });
      if ((after.attemptCount || 0) < 2) {
        await enqueueJob("ndrReattempt", {
          waybill,
          deliveryId: String(delivery._id),
        });
      } else {
        await Delivery.findByIdAndUpdate(delivery._id, {
          $set: { status: "rto" },
        });
      }
      return;
    }

    await Delivery.findByIdAndUpdate(delivery._id, upd);
    // Optionally notify user via push/sms
    await enqueueJob("notifyCustomer", {
      userId: delivery.client,
      deliveryId: String(delivery._id),
      status: mappedStatus,
    });
  } catch (err) {
    console.error("delhiveryScanWebhook processing error", err);
  }
};

// 7) Delhivery webhook: doc-push (POD / QC images / EPOD)
export const delhiveryDocWebhook = async (req, res) => {
  try {
    res.status(200).send("OK");
    const payload = req.body;
    await mongoose.connection.collection("delhivery_webhooks").insertOne({
      type: "doc_push",
      payload,
      receivedAt: new Date(),
    });

    const waybill = payload.waybill || payload.awb || payload.awb_no;
    const docType = payload.doc_type || payload.type || "UNKNOWN";
    const urls =
      payload.urls ||
      payload.doc_urls ||
      (payload.data && payload.data.urls) ||
      [];

    if (!waybill) {
      console.warn("delhiveryDocWebhook: no waybill", payload);
      return;
    }

    const delivery = await Delivery.findOne({
      $or: [
        { "delhiveryRaw.waybill": waybill },
        { "delhiveryRaw.shipments.waybill": waybill },
        { waybill },
      ],
    });

    const docs = urls.map((u) => ({
      waybill,
      docType,
      url: u,
      receivedAt: new Date(),
    }));
    if (docs.length > 0) {
      await mongoose.connection
        .collection("delivery_documents")
        .insertMany(docs);
    }

    // enqueue download & persist job
    await enqueueJob("downloadDeliveryDocs", {
      waybill,
      docType,
      urls,
      deliveryId: delivery?._id,
    });

    if (/epod|pod|signature|r_vp_qc/i.test(docType)) {
      await enqueueJob("reconcileDeliveryWithDocs", {
        deliveryId: delivery?._id,
        waybill,
        docType,
      });
    }
  } catch (err) {
    console.error("delhiveryDocWebhook err", err);
  }
};

// 8) NDR reattempt job trigger endpoint (manual)
export const triggerNdr = async (req, res) => {
  try {
    const { waybill, action } = req.body;
    if (!waybill || !action)
      return res.status(400).json({ error: "waybill and action required" });
    const data = [{ waybill, act: action }];
    const resp = await delhiveryPost("/api/p/update", { data });
    await mongoose.connection.collection("ndr_requests").insertOne({
      waybill,
      action,
      resp,
      requestedAt: new Date(),
    });
    return res.json({ ok: true, resp });
  } catch (err) {
    console.error("triggerNdr err", err);
    return res.status(500).json({ error: err?.response?.data || err.message });
  }
};

// 9) getShipmentStatus - local status + optionally call Delhivery track API
export const getShipmentStatus = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const delivery = await Delivery.findById(deliveryId).populate("order");
    if (!delivery) return res.status(404).json({ error: "Delivery not found" });

    const wantFresh = req.query.fresh === "true";
    let dl = null;
    if (wantFresh) {
      let waybill =
        delivery.waybill ||
        delivery.delhiveryRaw?.waybill ||
        (delivery.delhiveryRaw?.shipments &&
          delivery.delhiveryRaw.shipments[0]?.waybill);
      if (waybill) {
        try {
          dl = await delhiveryGet("/api/v1/packages/json/", {
            waybill,
            ref_ids: "",
          });
        } catch (e) {
          // ignore errors, return local state
        }
      }
    }

    return res.json({ ok: true, delivery, delhivery: dl });
  } catch (err) {
    console.error("getShipmentStatus err", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};

export const delhiveryAPI = {
  createShipmentLabel: async (orderId, deliveryId) => {
    const delhivery = await getDelhiveryInstance();
    // Placeholder implementation
    console.log("Creating shipment label for order:", orderId, "delivery:", deliveryId);
    return { ok: true, message: "Label created" };
  },
  downloadDocuments: async (waybill, payload) => {
    const delhivery = await getDelhiveryInstance();
    // Placeholder implementation
    console.log("Downloading documents for waybill:", waybill, "payload:", payload);
    return { ok: true, message: "Documents downloaded" };
  },
  scheduleRetry: async (waybill, payload) => {
    const delhivery = await getDelhiveryInstance();
    // Placeholder implementation
    console.log("Scheduling retry for waybill:", waybill, "payload:", payload);
    return { ok: true, message: "Retry scheduled" };
  },
  sendOTPToCustomer: async (userId, deliveryId, otp, status) => {
    const delhivery = await getDelhiveryInstance();
    // Placeholder implementation
    console.log("Sending OTP to customer:", userId, "delivery:", deliveryId, "otp:", otp, "status:", status);
    return { ok: true, message: "OTP sent" };
  },
  reconcileWithDocs: async (deliveryId, waybill, docType) => {
    const delhivery = await getDelhiveryInstance();
    // Placeholder implementation
    console.log("Reconciling with docs for delivery:", deliveryId, "waybill:", waybill, "docType:", docType);
    return { ok: true, message: "Reconciled" };
  },
};
