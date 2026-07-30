// scripts/seed.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import models - CORRECTED
const { User } = require("../src/models/User.model");
const { Department } = require("../src/models/Department.model");

// Define userRoles
const userRoles = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  HR_MANAGER: 'hr_manager',
  DEPT_MANAGER: 'dept_manager',
  PROJECT_MANAGER: 'project_manager',
  LINE_MANAGER: 'line_manager',
  EMPLOYEE: 'employee'
};

const seedDatabase = async () => {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Check if models are loaded correctly
    console.log("📦 Models loaded:", {
      User: typeof User,
      UserMethods: Object.keys(User),
      Department: typeof Department
    });

    // Clear existing data
    console.log("\n🗑️  Clearing existing data...");
    await User.deleteMany({});
    await Department.deleteMany({});
    console.log("✅ Cleared existing data");

    // Create departments
    console.log("\n📁 Creating departments...");
    const departments = await Department.insertMany([
      {
        name: "Software Engineering",
        code: "SWE",
        description: "Software development and engineering",
      },
      {
        name: "Human Resources",
        code: "HR",
        description: "Human resources management",
      },
      {
        name: "Business Development",
        code: "BIZ",
        description: "Sales and business development",
      },
    ]);
    console.log(`✅ Created ${departments.length} departments`);

    // Hash password
    console.log("\n🔐 Hashing password...");
    const hashedPassword = await bcrypt.hash("Admin@123", 10);
    console.log("✅ Password hashed");

    // Create users
    console.log("\n👤 Creating users...");

    // 1. Super Admin
    const superAdmin = await User.create({
      fullName: "System Super Admin",
      email: "superadmin@taskmanager.com",
      password: hashedPassword,
      employeeId: "SA001",
      role: userRoles.SUPER_ADMIN,
      isActive: true,
      isVerified: true,
      isEmailVerified: true,
      firstLogin: false,
    });
    console.log(`  ✅ Created: ${superAdmin.email} (${superAdmin.role})`);

    // 2. Admin
    const admin = await User.create({
      fullName: "System Admin",
      email: "admin@taskmanager.com",
      password: hashedPassword,
      employeeId: "AD001",
      role: userRoles.ADMIN,
      isActive: true,
      isVerified: true,
      isEmailVerified: true,
      firstLogin: false,
    });
    console.log(`  ✅ Created: ${admin.email} (${admin.role})`);

    // 3. HR Manager
    const hrManager = await User.create({
      fullName: "HR Manager",
      email: "hr@taskmanager.com",
      password: hashedPassword,
      employeeId: "HR001",
      role: userRoles.HR_MANAGER,
      department: departments[1]._id,
      isActive: true,
      isVerified: true,
      isEmailVerified: true,
      firstLogin: false,
    });
    console.log(`  ✅ Created: ${hrManager.email} (${hrManager.role})`);

    // 4. Department Manager
    const deptManager = await User.create({
      fullName: "Software Engineering Manager",
      email: "manager@taskmanager.com",
      password: hashedPassword,
      employeeId: "MGR001",
      role: userRoles.DEPT_MANAGER,
      department: departments[0]._id,
      isActive: true,
      isVerified: true,
      isEmailVerified: true,
      firstLogin: false,
    });
    console.log(`  ✅ Created: ${deptManager.email} (${deptManager.role})`);

    // 5. Project Manager
    const projectManager = await User.create({
      fullName: "Project Manager",
      email: "pm@taskmanager.com",
      password: hashedPassword,
      employeeId: "PM001",
      role: userRoles.PROJECT_MANAGER,
      department: departments[0]._id,
      isActive: true,
      isVerified: true,
      isEmailVerified: true,
      firstLogin: false,
    });
    console.log(`  ✅ Created: ${projectManager.email} (${projectManager.role})`);

    // 6. Line Manager
    const lineManager = await User.create({
      fullName: "Line Manager",
      email: "linemanager@taskmanager.com",
      password: hashedPassword,
      employeeId: "LM001",
      role: userRoles.LINE_MANAGER,
      department: departments[0]._id,
      isActive: true,
      isVerified: true,
      isEmailVerified: true,
      firstLogin: false,
    });
    console.log(`  ✅ Created: ${lineManager.email} (${lineManager.role})`);

    // 7. Employee 1
    const employee1 = await User.create({
      fullName: "John Employee",
      email: "employee@taskmanager.com",
      password: hashedPassword,
      employeeId: "EMP001",
      role: userRoles.EMPLOYEE,
      department: departments[0]._id,
      isActive: true,
      isVerified: true,
      isEmailVerified: true,
      firstLogin: true,
    });
    console.log(`  ✅ Created: ${employee1.email} (${employee1.role})`);

    // 8. Employee 2
    const employee2 = await User.create({
      fullName: "Jane Developer",
      email: "jane@taskmanager.com",
      password: hashedPassword,
      employeeId: "EMP002",
      role: userRoles.EMPLOYEE,
      department: departments[0]._id,
      isActive: true,
      isVerified: true,
      isEmailVerified: true,
      firstLogin: true,
    });
    console.log(`  ✅ Created: ${employee2.email} (${employee2.role})`);

    // 9. Employee 3 - HR
    const employee3 = await User.create({
      fullName: "Alice HR Specialist",
      email: "alice@taskmanager.com",
      password: hashedPassword,
      employeeId: "EMP003",
      role: userRoles.EMPLOYEE,
      department: departments[1]._id,
      isActive: true,
      isVerified: true,
      isEmailVerified: true,
      firstLogin: true,
    });
    console.log(`  ✅ Created: ${employee3.email} (${employee3.role})`);

    // 10. Employee 4 - Business
    const employee4 = await User.create({
      fullName: "Bob Business Analyst",
      email: "bob@taskmanager.com",
      password: hashedPassword,
      employeeId: "EMP004",
      role: userRoles.EMPLOYEE,
      department: departments[2]._id,
      isActive: true,
      isVerified: true,
      isEmailVerified: true,
      firstLogin: true,
    });
    console.log(`  ✅ Created: ${employee4.email} (${employee4.role})`);

    // Update department counts
    console.log("\n📊 Updating department counts...");
    for (const dept of departments) {
      const count = await User.countDocuments({ department: dept._id });
      dept.employeeCount = count;
      await dept.save();
      console.log(`   ${dept.name}: ${count} employees`);
    }

    console.log("\n========================================");
    console.log("✅ Database seeded successfully!");
    console.log(`   Created ${await User.countDocuments()} users`);
    console.log("========================================");
    console.log("\n🔐 LOGIN CREDENTIALS:");
    console.log("========================================");
    console.log("🔑 Password for ALL users: Admin@123");
    console.log("========================================");
    console.log("\n👤 User Accounts:");
    console.log("----------------------------------------");
    console.log("Super Admin:       superadmin@taskmanager.com");
    console.log("Admin:             admin@taskmanager.com");
    console.log("HR Manager:        hr@taskmanager.com");
    console.log("Dept Manager:      manager@taskmanager.com");
    console.log("Project Manager:   pm@taskmanager.com");
    console.log("Line Manager:      linemanager@taskmanager.com");
    console.log("Employee:          employee@taskmanager.com");
    console.log("Developer:         jane@taskmanager.com");
    console.log("HR Specialist:     alice@taskmanager.com");
    console.log("Business Analyst:  bob@taskmanager.com");
    console.log("========================================\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

seedDatabase();