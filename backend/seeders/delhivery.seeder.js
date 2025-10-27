
import 'dotenv/config.js';
import mongoose from "mongoose";
import connectDB from "../Config/db.js";

// Define a simple schema for pickup locations
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

const seedDelhivery = async () => {
  console.log("Starting Delhivery seeder...");
  await connectDB();
  console.log("Database connected.");

  try {
    // Check if a default location already exists
    const existing = await PickupLocation.findOne({ isDefault: true });
    console.log("Existing location:", existing);
    if (existing) {
      console.log("Default pickup location already exists.");
      return;
    }

    // Create a default pickup location
    console.log("Creating default pickup location...");
    await PickupLocation.create({
      name: "Default Warehouse",
      address: "123, Industrial Area",
      pincode: "110037",
      city: "New Delhi",
      state: "Delhi",
      country: "India",
      phone: "9876543210",
      isDefault: true,
    });

    console.log("Delhivery seeder executed successfully: Default pickup location added.");
  } catch (error) {
    console.error("Error seeding Delhivery data:", error);
  } finally {
    mongoose.connection.close();
    console.log("Database connection closed.");
  }
};

seedDelhivery();
