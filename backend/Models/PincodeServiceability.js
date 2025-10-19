
import mongoose from "mongoose";

const PincodeServiceabilitySchema = new mongoose.Schema(
  {
    pincode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    isServiceable: {
      type: Boolean,
      default: true,
    },
    deliveryDays: {
      type: Number,
      required: true,
    },
    codAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("PincodeServiceability", PincodeServiceabilitySchema);
