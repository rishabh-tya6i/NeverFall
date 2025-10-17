// Services/delivery.worker.js
import pkg from "bullmq";
// try a few shapes for exports (commonjs default / esm named)
const BullMQ = pkg || {};
const WorkerCtor = BullMQ.Worker || BullMQ.default?.Worker;
const QueueCtor = BullMQ.Queue || BullMQ.default?.Queue;
const QueueSchedulerCtor =
  BullMQ.QueueScheduler || BullMQ.default?.QueueScheduler;
import { redisBullMQ as redis } from "../lib/redis.js";
import Order from "../Models/Order.js";
import ReturnRequest from "../Models/ReturnRequest.js";
import ExchangeRequest from "../Models/ExchangeRequest.js";
import { delhivery as delhiveryAPI } from "../Controllers/delivery.controller.js";
import logger from "../utils/logger.js"; // keep as-is

const log = logger || console;
const QUEUE_NAME = "delivery-jobs";

// Defensive: ensure QueueCtor and WorkerCtor are present
if (!QueueCtor) {
  log.error?.("bullmq Queue export not found. Install/upgrade bullmq.");
  throw new Error("bullmq Queue export not found");
}
if (!WorkerCtor) {
  log.error?.("bullmq Worker export not found. Install/upgrade bullmq.");
  throw new Error("bullmq Worker export not found");
}

// create scheduler to handle stalled jobs / retries if available
try {
  if (typeof QueueSchedulerCtor === "function") {
    // Some environments need `new`, some might export a factory — try new first
    try {
      // attempt constructor style
      // eslint-disable-next-line no-new
      new QueueSchedulerCtor(QUEUE_NAME, { connection: redis });
      log.info?.("QueueScheduler instantiated using constructor");
    } catch (e) {
      // fallback: try calling without new (some versions export a function)
      try {
        QueueSchedulerCtor(QUEUE_NAME, { connection: redis });
        log.info?.("QueueScheduler instantiated by calling function");
      } catch (e2) {
        log.warn?.(
          "QueueScheduler exists but could not be instantiated. Skipping scheduler.",
          e2?.message || e2
        );
      }
    }
  } else {
    log.warn?.(
      "QueueScheduler not available in bullmq import — continuing without queue scheduler."
    );
  }
} catch (err) {
  log.warn?.(
    "Error while creating QueueScheduler (non-fatal):",
    err?.message || err
  );
}

// export queue for controllers to use
export const deliveryQueue = new QueueCtor(QUEUE_NAME, { connection: redis });

// Worker factory
export const deliveryWorker = new WorkerCtor(
  QUEUE_NAME,
  async (job) => {
    const type = job.name || job.data?.type;
    const payload = job.data?.payload || job.data || {};

    log.info?.(`Processing job ${job.id} type=${type}`, { payload });

    try {
      switch (type) {
        case "generateLabel":
          return await delhiveryAPI?.createShipmentLabel?.(
            payload.orderId,
            payload.deliveryId
          );

        case "downloadDeliveryDocs":
          return await delhiveryAPI?.downloadDocuments?.(
            payload.waybill || payload.deliveryId,
            payload
          );

        case "postDeliveryProcessing":
          if (!payload.orderId) throw new Error("orderId required");
          {
            const order = await Order.findById(payload.orderId);
            if (!order) throw new Error("Order not found");
            order.status = payload.deliveryStatus || order.status;
            await order.save();
            return order;
          }

        case "ndrReattempt":
          return await delhiveryAPI?.scheduleRetry?.(
            payload.waybill || payload.deliveryId,
            payload
          );

        case "notifyCustomer":
          if (!delhiveryAPI?.sendOTPToCustomer) {
            log.warn?.("sendOTPToCustomer not implemented on delhiveryAPI");
            return { ok: false, message: "notifier-not-implemented" };
          }
          return await delhiveryAPI.sendOTPToCustomer(
            payload.userId,
            payload.deliveryId,
            payload.otp,
            payload.status
          );

        case "reconcileDeliveryWithDocs":
          return await delhiveryAPI?.reconcileWithDocs?.(
            payload.deliveryId,
            payload.waybill,
            payload.docType
          );

        default:
          throw new Error(`Unknown job type: ${type}`);
      }
    } catch (err) {
      log.error?.(`Job ${job.id} type=${type} failed`, err);
      throw err;
    }
  },
  { connection: redis, concurrency: 5 }
);

// event handlers
deliveryWorker.on("completed", (job) => {
  log.info?.(`Job ${job.id} completed`, { name: job.name, data: job.data });
});
deliveryWorker.on("failed", (job, err) => {
  log.error?.(`Job ${job.id} failed`, err);
});

export default { deliveryQueue, deliveryWorker };
