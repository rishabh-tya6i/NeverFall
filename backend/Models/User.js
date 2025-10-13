import mongoose from "mongoose";
const AddressSchema = new mongoose.Schema(
  {
    name: String,
    phone: String,
    pincode: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "User",
    },
    phone: { type: String, unique: true, index: true, required: true },
    email: { type: String, unique: true, sparse: true, index: true },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "male",
    },
    role: {
      type: String,
      enum: ["user", "admin", "Support", "manager"],
      default: "user",
    },
    addresses: { type: [AddressSchema], default: [] },
    wallet: { balance: { type: Number, default: 0 } },
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
