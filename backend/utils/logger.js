// utils/logger.js
import fs from "fs";
import path from "path";
import winston from "winston";

const LOG_DIR = process.env.LOG_DIR || "logs";
// Ensure log dir exists (silently)
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
} catch (e) {
  // ignore errors creating folder; winston will still log to console
  // eslint-disable-next-line no-console
  console.warn("Could not create log directory", LOG_DIR, e?.message || e);
}

const defaultFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  // You can tweak format here: json for files, simple for console
  winston.format.json()
);

// Default transports
const transports = [
  new winston.transports.File({
    filename: path.join(LOG_DIR, "error.log"),
    level: "error",
  }),
  new winston.transports.File({
    filename: path.join(LOG_DIR, "combined.log"),
  }),
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
];

/**
 * Default logger instance (generic service)
 * Usage: import logger from "../utils/logger.js"; logger.info("hi")
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: defaultFormat,
  defaultMeta: { service: process.env.SERVICE_NAME || "app-service" },
  transports,
});

/**
 * createLogger(serviceName)
 * - returns a child-like logger with defaultMeta.service set
 * - Usage: const log = createLogger("delivery-worker"); log.info(...)
 */
export function createLogger(serviceName = "app-service") {
  return logger.child({ service: serviceName });
}

export default logger;
