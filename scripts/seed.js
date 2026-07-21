// scripts/seed-simple.js
// ==================== DNS OVERRIDE ====================
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
console.log("✅ DNS servers set");

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env") });

console.log(`📁 Project root: ${path.join(__dirname, "..")}`);

// Import models
const User = require("../src/models/User.model");

// ============================================================================
// SEED FUNCTION - Simplified version
// ============================================================================

const seedDatabase = async () => {
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

    // ========================================================================
    // 1. CLEAR EXISTING DATA
    // ========================================================================
    console.log("🗑️  Clearing existing users...");
    
    try {
      await User.deleteMany({});
      console.log("  ✅ Users cleared");
    } catch (error) {
      console.warn("  ⚠️ Could not clear users:", error.message);
    }

    // ========================================================================
    // 2. HASH PASSWORD
    // ========================================================================
    const hashedPassword = await bcrypt.hash("Admin@123", 10);
    console.log("🔐 Password hashed\n");

    // ========================================================================
    // 3. CREATE USERS
    // ========================================================================
    console.log("👤 Creating users...");

    const users = [
      {
        fullName: "System Super Admin",
        email: "superadmin@taskmanager.com",
        password: hashedPassword,
        employeeId: "SA001",
        role: "super_admin",
        isActive: true,
        firstLogin: false,
      },
      {
        fullName: "System Admin",
        email: "admin@taskmanager.com",
        password: hashedPassword,
        employeeId: "AD001",
        role: "admin",
        isActive: true,
        firstLogin: false,
      },
      {
        fullName: "HR Manager",
        email: "hr@taskmanager.com",
        password: hashedPassword,
        employeeId: "HR001",
        role: "hr_manager",
        isActive: true,
        firstLogin: false,
      },
      {
        fullName: "Department Manager",
        email: "manager@taskmanager.com",
        password: hashedPassword,
        employeeId: "MGR001",
        role: "dept_manager",
        isActive: true,
        firstLogin: false,
      },
      {
        fullName: "Project Manager",
        email: "pm@taskmanager.com",
        password: hashedPassword,
        employeeId: "PM001",
        role: "project_manager",
        isActive: true,
        firstLogin: false,
      },
      {
        fullName: "John Employee",
        email: "employee@taskmanager.com",
        password: hashedPassword,
        employeeId: "EMP001",
        role: "employee",
        isActive: true,
        firstLogin: true,
      },
    ];

    let created = 0;
    for (const userData of users) {
      try {
        // Check if user exists
        const existing = await User.findOne({ email: userData.email });
        if (existing) {
          console.log(`  ⏭️  Skipped: ${userData.email} (already exists)`);
          continue;
        }

        const user = await User.create(userData);
        console.log(`  ✅ Created: ${user.fullName} (${user.email})`);
        created++;
      } catch (error) {
        console.error(`  ❌ Failed to create ${userData.email}:`, error.message);
      }
    }

    // ========================================================================
    // 4. OUTPUT SUMMARY
    // ========================================================================
    console.log("\n========================================");
    console.log("✅ Database seeded successfully!");
    console.log(`   Created ${created} users`);
    console.log("========================================");
    console.log("\n🔐 LOGIN CREDENTIALS:");
    console.log("========================================");
    console.log("Super Admin:   superadmin@taskmanager.com / Admin@123");
    console.log("Admin:         admin@taskmanager.com / Admin@123");
    console.log("HR Manager:    hr@taskmanager.com / Admin@123");
    console.log("Dept Manager:  manager@taskmanager.com / Admin@123");
    console.log("Project Mgr:   pm@taskmanager.com / Admin@123");
    console.log("Employee:      employee@taskmanager.com / Admin@123");
    console.log("========================================\n");

    await mongoose.connection.close();
    console.log("✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed error:", error);
    console.error("📚 Stack:", error.stack);

    if (error.name === "MongooseServerSelectionError") {
      console.log("\n💡 TROUBLESHOOTING:");
      console.log("  1. Add your IP to MongoDB Atlas whitelist");
      console.log("  2. Check your internet connection");
      console.log("  3. Verify your MONGODB_URI in .env file");
    }
    process.exit(1);
  }
};

seedDatabase();