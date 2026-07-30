// scripts/fix-password.js
// ==================== DNS OVERRIDE ====================
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
console.log("✅ DNS servers set");

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const { User } = require("../src/models/User.model");

const fixPassword = async () => {
  try {
    console.log("🔌 Connecting to MongoDB...");
    console.log(`📡 URI: ${process.env.MONGODB_URI ? "✅ Found" : "❌ Not found"}`);
    
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined in .env file");
    }

    const mongooseOptions = {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      maxPoolSize: 10,
    };

    await mongoose.connect(process.env.MONGODB_URI, mongooseOptions);
    console.log("✅ Connected to MongoDB\n");

    const email = "superadmin@taskmanager.com";
    const newPassword = "superadmin@taskmanager.com";

    // Find the user
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      console.log("❌ User not found:", email);
      process.exit(1);
    }

    console.log("👤 User found:", user.email);
    console.log("🔑 Current hash:", user.password);

    // Generate new hash
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);
    console.log("🔑 New hash:", newHash);

    // Update the password
    user.password = newPassword; // Let pre-save hook handle hashing
    await user.save();

    // Verify the update
    const updatedUser = await User.findOne({ email }).select("+password");
    console.log("✅ Password updated!");
    console.log("🔑 New hash in DB:", updatedUser.password);

    // Test the password
    const isValid = await bcrypt.compare(newPassword, updatedUser.password);
    console.log("🔐 Password verification:", isValid ? "✅ VALID" : "❌ INVALID");

    if (isValid) {
      console.log("\n🎉 SUCCESS! You can now login with:");
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${newPassword}`);
    } else {
      console.log("\n❌ Password verification failed. Please check the pre-save hook.");
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

fixPassword();