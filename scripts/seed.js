// scripts/seed-simple.js
// ==================== DNS OVERRIDE ====================
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
console.log("✅ DNS servers set");

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs"); // ← ADD THIS
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env") });

console.log(`📁 Project root: ${path.join(__dirname, "..")}`);

// Import models
const { User } = require("../src/models/User.model");

// ============================================================================
// SEED FUNCTION - Let Mongoose hash the password
// ============================================================================

const seedDatabase = async () => {
  try {
    console.log("🔌 Connecting to MongoDB...");
    console.log(`📡 URI: ${process.env.MONGODB_URI ? "✅ Found" : "❌ Not found"}`);

    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined in .env file");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Clear existing data
    console.log("🗑️  Clearing existing users...");
    await User.deleteMany({});
    console.log("  ✅ Users cleared\n");

    // Define users with plain text passwords
    console.log("👤 Creating users with email as password...");

    const userDataList = [
      {
        fullName: "System Super Admin",
        email: "superadmin@taskmanager.com",
        password: "superadmin@taskmanager.com",
        employeeId: "SA001",
        role: "super_admin",
        isActive: true,
        firstLogin: false,
        isVerified: true,
        isEmailVerified: true,
      },
      {
        fullName: "System Admin",
        email: "admin@taskmanager.com",
        password: "admin@taskmanager.com",
        employeeId: "AD001",
        role: "admin",
        isActive: true,
        firstLogin: false,
        isVerified: true,
        isEmailVerified: true,
      },
      {
        fullName: "HR Manager",
        email: "hr@taskmanager.com",
        password: "hr@taskmanager.com",
        employeeId: "HR001",
        role: "hr_manager",
        isActive: true,
        firstLogin: false,
        isVerified: true,
        isEmailVerified: true,
      },
      {
        fullName: "Department Manager",
        email: "manager@taskmanager.com",
        password: "manager@taskmanager.com",
        employeeId: "MGR001",
        role: "dept_manager",
        isActive: true,
        firstLogin: false,
        isVerified: true,
        isEmailVerified: true,
      },
      {
        fullName: "Project Manager",
        email: "pm@taskmanager.com",
        password: "pm@taskmanager.com",
        employeeId: "PM001",
        role: "project_manager",
        isActive: true,
        firstLogin: false,
        isVerified: true,
        isEmailVerified: true,
      },
      {
        fullName: "Line Manager",
        email: "linemanager@taskmanager.com",
        password: "linemanager@taskmanager.com",
        employeeId: "LM001",
        role: "line_manager",
        isActive: true,
        firstLogin: false,
        isVerified: true,
        isEmailVerified: true,
      },
      {
        fullName: "John Employee",
        email: "employee@taskmanager.com",
        password: "employee@taskmanager.com",
        employeeId: "EMP001",
        role: "employee",
        isActive: true,
        firstLogin: true,
        isVerified: true,
        isEmailVerified: true,
      },
      {
        fullName: "Jane Developer",
        email: "jane@taskmanager.com",
        password: "jane@taskmanager.com",
        employeeId: "EMP002",
        role: "employee",
        isActive: true,
        firstLogin: true,
        isVerified: true,
        isEmailVerified: true,
      },
      {
        fullName: "Alice HR Specialist",
        email: "alice@taskmanager.com",
        password: "alice@taskmanager.com",
        employeeId: "EMP003",
        role: "employee",
        isActive: true,
        firstLogin: true,
        isVerified: true,
        isEmailVerified: true,
      },
      {
        fullName: "Bob Business Analyst",
        email: "bob@taskmanager.com",
        password: "bob@taskmanager.com",
        employeeId: "EMP004",
        role: "employee",
        isActive: true,
        firstLogin: true,
        isVerified: true,
        isEmailVerified: true,
      },
    ];

    let created = 0;
    let failed = 0;

    for (const userData of userDataList) {
      try {
        // Create user - let the pre-save hook handle password hashing
        const user = await User.create(userData);
        console.log(`  ✅ Created: ${user.fullName} (${user.email}) - Role: ${user.role}`);
        created++;
      } catch (error) {
        console.error(`  ❌ Failed to create ${userData.email}:`, error.message);
        failed++;
      }
    }

    // Verify users and test passwords
    console.log("\n🔐 Verifying passwords...");
    for (const userData of userDataList) {
      try {
        const user = await User.findOne({ email: userData.email }).select("+password");
        if (user) {
          const isValid = await bcrypt.compare(userData.password, user.password);
          console.log(`  ${userData.email}: ${isValid ? '✅ Password valid' : '❌ Password invalid'}`);
        } else {
          console.log(`  ${userData.email}: ❌ User not found`);
        }
      } catch (error) {
        console.log(`  ${userData.email}: ❌ Error verifying - ${error.message}`);
      }
    }

    const totalUsers = await User.countDocuments();
    console.log(`\n📊 Total users in database: ${totalUsers}`);

    console.log("\n========================================");
    console.log("✅ Database seeded successfully!");
    console.log(`   Created: ${created} users`);
    console.log(`   Failed: ${failed} users`);
    console.log(`   Total: ${totalUsers} users`);
    console.log("========================================");
    console.log("\n🔐 LOGIN CREDENTIALS:");
    console.log("========================================");
    console.log("🔑 Password for each user = their email address");
    console.log("========================================\n");
    console.log("📋 User Accounts (Email / Password):");
    console.log("----------------------------------------");
    userDataList.forEach(u => {
      console.log(`  ${u.email} / ${u.email}`);
    });
    console.log("========================================\n");

    await mongoose.connection.close();
    console.log("✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed error:", error);
    console.error("📚 Stack:", error.stack);
    process.exit(1);
  }
};

seedDatabase();