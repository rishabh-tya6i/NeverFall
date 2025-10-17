// services/courier.service.js
import axios from "axios";
import dayjs from "dayjs";

/**
 * scheduleCourierPickup(exchange)
 *
 * - input: `exchange` - ExchangeRequest mongoose doc (or a plain object containing
 *   enough address & order info). Expected minimal shape:
 *     {
 *       _id,
 *       user: ObjectId or userId,
 *       selectedReplacement: { quantity, ... },
 *       originalOrderId,
 *       meta: { ... },
 *       // important: we expect exchange.originalOrderId -> Order with deliveryAddress saved
 *     }
 *
 * - behavior:
 *   1. builds a pickup payload using env vars / exchange info
 *   2. calls Delhivery pickup endpoint (staging/production depending on env)
 *   3. returns a normalized pickupWindow object on success:
 *      { scheduled: true, pickupId, scheduledDate, timeWindow, raw }
 *   4. returns null on failure (controller will handle accordingly)
 *
 * Env expected:
 *   DELHIVERY_TOKEN           - bearer/token for Delhivery
 *   DELHIVERY_BASE_URL        - e.g. https://staging-express.delhivery.com or production base
 *   DELHIVERY_PICKUP_PATH     - optional, defaults to '/fm/request/new/' (common staging path)
 *   DEFAULT_PICKUP_WAREHOUSE  - your warehouse code/id if needed by Delhivery
 */

const DELHIVERY_TOKEN = process.env.DELHIVERY_TOKEN || "";
const BASE_URL =
  process.env.DELHIVERY_BASE_URL || "https://staging-express.delhivery.com"; // override in production
const PICKUP_PATH = process.env.DELHIVERY_PICKUP_PATH || "/fm/request/new/";

/**
 * Helper: build a minimal pickup payload.
 * NOTE: This is a sample flexible payload. Replace/extend fields per your Delhivery account docs.
 */
function buildPickupPayload({ exchange, warehouse }) {
  // Best practice: derive address from your Order model; here we accept exchange.meta.pickupAddress
  const pickupAddress = exchange.meta?.pickupAddress ||
    warehouse?.address || {
      name: "Warehouse",
      phone: "0000000000",
      addressLine1: "Warehouse address line 1",
      city: "City",
      state: "State",
      pincode: "000000",
    };

  // schedule for next working day by default
  const scheduledDate = dayjs().add(1, "day").format("YYYY-MM-DD");

  // time window fallback
  const timeWindow = exchange.meta?.preferredTimeWindow || "10:00-18:00";

  // Example minimal payload shape. Adapt per your account docs.
  const payload = {
    // account/partner identifiers (if required by your integration)
    // client_id: process.env.DELHIVERY_CLIENT_ID,

    pickup_date: scheduledDate,
    pickup_time: timeWindow,
    pickup_location: {
      name: pickupAddress.name,
      phone: pickupAddress.phone,
      address_line_1: pickupAddress.addressLine1,
      address_line_2: pickupAddress.addressLine2 || "",
      city: pickupAddress.city,
      state: pickupAddress.state,
      pincode: pickupAddress.pincode,
    },

    // shipments array - minimal info to inform the pickup agent
    shipments: [
      {
        reference_id: `EX-${exchange._id}`, // your internal ref
        // You can include reverse/return flags or order ids here if you use Reverse DTO
        qty: exchange.selectedReplacement?.quantity || 1,
        // any other fields Delhivery needs (weight, dimensions, articles, etc.)
      },
    ],

    // meta to help downstream reconciliation
    comments: `Exchange pickup for exchangeId:${exchange._id}`,
  };

  return payload;
}

/**
 * scheduleCourierPickup
 * Returns { scheduled: true, pickupId, scheduledDate, timeWindow, raw } on success
 * or null on failure.
 */
export async function scheduleCourierPickup(exchange, opts = {}) {
  // quick guard—no token or base URL configured => skip external call
  if (!DELHIVERY_TOKEN || !BASE_URL) {
    console.warn(
      "Delhivery not configured (DELHIVERY_TOKEN or DELHIVERY_BASE_URL missing). Skipping pickup scheduling."
    );
    return null;
  }

  // allow override of warehouse/pickupAddress via opts
  const warehouse = opts.warehouse || {
    code: process.env.DEFAULT_PICKUP_WAREHOUSE,
    address: opts.pickupAddress || null,
  };

  const payload = buildPickupPayload({ exchange, warehouse });

  const url = `${BASE_URL.replace(/\/$/, "")}${PICKUP_PATH}`;

  try {
    const resp = await axios.post(url, payload, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        // Delhivery commonly expects 'Authorization: Token <token>' or similar.
        // Use the header style your account expects. Many integrations use:
        //  Authorization: `Token ${DELHIVERY_TOKEN}`
        Authorization: `Token ${DELHIVERY_TOKEN}`,
      },
      timeout: 20_000,
    });

    // NOTE: Delhivery response shape depends on account & environment. Normalize it.
    const data = resp?.data || {};

    // Example: if the platform returns a pickup id / reference, adapt below.
    const pickupId = data.id || data.pickup_id || data.request_id || null;
    const scheduledDate = payload.pickup_date;
    const timeWindow = payload.pickup_time;

    return {
      scheduled: true,
      pickupId,
      scheduledDate,
      timeWindow,
      raw: data,
    };
  } catch (err) {
    // Log helpful debug info for troubleshooting integrations
    console.error("scheduleCourierPickup error:", {
      message: err.message,
      url,
      payload,
      status: err?.response?.status,
      responseData: err?.response?.data,
    });
    return null;
  }
}

export default {
  scheduleCourierPickup,
};
