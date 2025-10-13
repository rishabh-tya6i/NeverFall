import mongoose from "mongoose";
const connectdb = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB connected URL ${process.env.MONGO_URI}`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};
export default connectdb;
