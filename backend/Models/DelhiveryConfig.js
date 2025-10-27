
import mongoose from "mongoose";

const delhiveryConfigSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      default: "default",
    },
    token: { type: String, required: true },
    baseUrl: {
      type: String,
      required: true,
      default: "https://track.delhivery.com",
    },
    stagingUrl: {
      type: String,
      default: "https://staging-express.delhivery.com",
    },
    isStaging: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const DelhiveryConfig = mongoose.model(
  "DelhiveryConfig",
  delhiveryConfigSchema
);

export default DelhiveryConfig;
