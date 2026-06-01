const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

dotenv.config();

const userSchema = new mongoose.Schema({
  fullName: String,
  email: String,
  password: String,
  employeeId: String,
  role: String,
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
  isActive: { type: Boolean, default: true },
});

const departmentSchema = new mongoose.Schema({
  name: String,
  code: String,
});

const User = mongoose.model("User", userSchema);
const Department = mongoose.model("Department", departmentSchema);

const seedEmployees = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Get departments
    const departments = await Department.find();
    if (departments.length === 0) {
      console.log("❌ No departments found. Please run seed.js first");
      console.log("Run: npm run seed");
      process.exit(1);
    }
    console.log(`📋 Found ${departments.length} departments`);

    const hashedPassword = await bcrypt.hash("Admin@123", 10);

    // Check if employees already exist
    const existingEmployees = await User.find({ role: "employee" });
    if (existingEmployees.length > 0) {
      console.log(
        `⚠️ ${existingEmployees.length} employees already exist. Skipping...`,
      );
      console.log("\n🔐 Existing Employee Credentials:");
      console.log("═══════════════════════════════════════════");
      existingEmployees.forEach((emp) => {
        console.log(`${emp.fullName}: ${emp.email} / Admin@123`);
      });
      console.log("═══════════════════════════════════════════\n");
      process.exit(0);
    }

    const employees = [
      {
        fullName: "John Doe",
        email: "john.doe@taskmanager.com",
        employeeId: "EMP001",
        deptIndex: 0,
      },
      {
        fullName: "Jane Smith",
        email: "jane.smith@taskmanager.com",
        employeeId: "EMP002",
        deptIndex: 0,
      },
      {
        fullName: "Mike Johnson",
        email: "mike.johnson@taskmanager.com",
        employeeId: "EMP003",
        deptIndex: 1,
      },
      {
        fullName: "Sarah Williams",
        email: "sarah.williams@taskmanager.com",
        employeeId: "EMP004",
        deptIndex: 1,
      },
      {
        fullName: "David Brown",
        email: "david.brown@taskmanager.com",
        employeeId: "EMP005",
        deptIndex: 2,
      },
      {
        fullName: "Emily Davis",
        email: "emily.davis@taskmanager.com",
        employeeId: "EMP006",
        deptIndex: 2,
      },
      {
        fullName: "Chris Wilson",
        email: "chris.wilson@taskmanager.com",
        employeeId: "EMP007",
        deptIndex: 0,
      },
      {
        fullName: "Lisa Anderson",
        email: "lisa.anderson@taskmanager.com",
        employeeId: "EMP008",
        deptIndex: 1,
      },
      {
        fullName: "Tom Martinez",
        email: "tom.martinez@taskmanager.com",
        employeeId: "EMP009",
        deptIndex: 2,
      },
      {
        fullName: "Amy Taylor",
        email: "amy.taylor@taskmanager.com",
        employeeId: "EMP010",
        deptIndex: 0,
      },
    ];

    console.log("\n📝 Creating employees...");
    for (const emp of employees) {
      const dept = departments[emp.deptIndex % departments.length];
      await User.create({
        fullName: emp.fullName,
        email: emp.email,
        password: hashedPassword,
        employeeId: emp.employeeId,
        role: "employee",
        departmentId: dept._id,
        isActive: true,
      });
      console.log(`   ✅ Created: ${emp.fullName} (${emp.email})`);
    }

    // Update department employee counts
    for (const dept of departments) {
      const count = await User.countDocuments({ departmentId: dept._id });
      await Department.findByIdAndUpdate(dept._id, { employeeCount: count });
    }

    console.log("\n✅ Employees seeded successfully!");
    console.log("\n🔐 EMPLOYEE LOGIN CREDENTIALS:");
    console.log("═══════════════════════════════════════════");
    employees.forEach((emp) => {
      console.log(`${emp.fullName}: ${emp.email} / Admin@123`);
    });
    console.log("═══════════════════════════════════════════\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

seedEmployees();
