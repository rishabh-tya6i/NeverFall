import mongoose from "mongoose";

const pincodeServiceabilitySchema = new mongoose.Schema(
  {
    pincode: { type: String, required: true, index: true },
    courier: { type: String, required: true, index: true },
    deliverable: { type: Boolean, required: true },
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

pincodeServiceabilitySchema.index({ pincode: 1, courier: 1 }, { unique: true });

const PincodeServiceability = mongoose.model(
  "PincodeServiceability",
  pincodeServiceabilitySchema
);

export default PincodeServiceability;