const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const { User, userRoles } = require("./src/models/User.model");
const { Department } = require("./src/models/Department.model");

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing data
    await User.deleteMany({});
    await Department.deleteMany({});
    console.log("✅ Cleared existing data");

    // Create departments
    const departments = await Department.insertMany([
      {
        name: "Software Engineering",
        code: "SWE",
        description: "Software development",
      },
      { name: "Human Resources", code: "HR", description: "HR management" },
      {
        name: "Business Development",
        code: "BIZ",
        description: "Sales and business",
      },
    ]);
    console.log("✅ Created departments");

    // Hash password
    const hashedPassword = await bcrypt.hash("Admin@123", 10);

    // Create Super Admin
    const superAdmin = await User.create({
      fullName: "System Super Admin",
      email: "superadmin@taskmanager.com",
      password: hashedPassword,
      employeeId: "SA001",
      role: userRoles.SUPER_ADMIN,
      firstLogin: false,
      isActive: true,
    });

    // Create Admin
    const admin = await User.create({
      fullName: "System Admin",
      email: "admin@taskmanager.com",
      password: hashedPassword,
      employeeId: "AD001",
      role: userRoles.ADMIN,
      firstLogin: false,
      isActive: true,
    });

    // Create HR Manager
    const hrManager = await User.create({
      fullName: "HR Manager",
      email: "hr@taskmanager.com",
      password: hashedPassword,
      employeeId: "HR001",
      role: userRoles.HR_MANAGER,
      firstLogin: false,
      isActive: true,
    });

    // Create Department Manager
    const deptManager = await User.create({
      fullName: "Software Engineering Manager",
      email: "manager@taskmanager.com",
      password: hashedPassword,
      employeeId: "MGR001",
      role: userRoles.DEPT_MANAGER,
      departmentId: departments[0]._id,
      firstLogin: false,
      isActive: true,
    });

    // Create Employee
    const employee = await User.create({
      fullName: "John Employee",
      email: "employee@taskmanager.com",
      password: hashedPassword,
      employeeId: "EMP001",
      role: userRoles.EMPLOYEE,
      departmentId: departments[0]._id,
      managerId: deptManager._id,
      firstLogin: true,
      isActive: true,
    });

    console.log("\n========================================");
    console.log("✅ Database seeded successfully!");
    console.log("========================================");
    console.log("\n🔐 LOGIN CREDENTIALS:");
    console.log("========================================");
    console.log("Super Admin:   superadmin@taskmanager.com / Admin@123");
    console.log("Admin:         admin@taskmanager.com / Admin@123");
    console.log("HR Manager:    hr@taskmanager.com / Admin@123");
    console.log("Dept Manager:  manager@taskmanager.com / Admin@123");
    console.log("Employee:      employee@taskmanager.com / Admin@123");
    console.log("========================================\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed error:", error);
    process.exit(1);
  }
};

seedDatabase();
