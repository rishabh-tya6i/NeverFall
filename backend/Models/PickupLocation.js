
import mongoose from "mongoose";

const pickupLocationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  address: { type: String, required: true },
  pincode: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  country: { type: String, required: true },
  phone: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
});

const PickupLocation = mongoose.model("PickupLocation", pickupLocationSchema);

export default PickupLocation;
