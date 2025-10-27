
import 'dotenv/config.js';
import mongoose from "mongoose";
import connectDB from "../Config/db.js";
import PincodeServiceability from "../Models/PincodeServiceability.js";

const seedPincodeServiceability = async () => {
  console.log("Starting PincodeServiceability seeder...");
  await connectDB();
  console.log("Database connected.");

  try {
    // Check if a default pincode already exists
    const existing = await PincodeServiceability.findOne({ pincode: "110037" });
    if (existing) {
      console.log("Default pincode serviceability already exists.");
      return;
    }

    // Create a default pincode serviceability
    console.log("Creating default pincode serviceability...");
    await PincodeServiceability.create({
      pincode: "110037",
      courier: "DELHIVERY",
      deliverable: true,
      details: {},
    });

    console.log("PincodeServiceability seeder executed successfully: Default pincode serviceability added.");
  } catch (error) {
    console.error("Error seeding PincodeServiceability data:", error);
  } finally {
    mongoose.connection.close();
    console.log("Database connection closed.");
  }
};

seedPincodeServiceability();
