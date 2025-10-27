
import 'dotenv/config.js';
import mongoose from "mongoose";
import connectDB from "../Config/db.js";
import DelhiveryConfig from "../Models/DelhiveryConfig.js";

const seedDelhiveryConfig = async () => {
  await connectDB();

  try {
    // Check if a default config already exists
    const existing = await DelhiveryConfig.findOne({ name: "default" });
    if (existing) {
      console.log("Default Delhivery config already exists.");
      return;
    }

    // Create a default config from environment variables
    await DelhiveryConfig.create({
      name: "default",
      token: process.env.DELHIVERY_TOKEN,
      baseUrl: process.env.DELHIVERY_BASE_URL || "https://track.delhivery.com",
      stagingUrl: process.env.DELHIVERY_STAGING_URL || "https://staging-express.delhivery.com",
      isStaging: process.env.DELHIVERY_STAGING === "true",
    });

    console.log("Delhivery config seeder executed successfully.");
  } catch (error) {
    console.error("Error seeding Delhivery config:", error);
  } finally {
    mongoose.connection.close();
  }
};

seedDelhiveryConfig();
