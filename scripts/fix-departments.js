// scripts/fix-departments.js
// ==================== DNS OVERRIDE ====================
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
console.log("✅ DNS servers set");

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const { User } = require("../src/models/User.model");
const { Department } = require("../src/models/Department.model");

const fixDepartments = async () => {
  try {
    console.log("🔌 Connecting to MongoDB...");

    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined in .env file");
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
    });
    console.log("✅ Connected to MongoDB\n");

    // ========================================
    // 1. GET ALL DEPARTMENTS
    // ========================================
    console.log("📁 Fetching departments...");
    const departments = await Department.find({});
    console.log(`✅ Found ${departments.length} departments:`);
    departments.forEach((d) => {
      console.log(`   - ${d.name} (${d.code}): ${d._id}`);
    });
    console.log();

    if (departments.length === 0) {
      console.log("⚠️ No departments found. Please create departments first.");
      process.exit(1);
    }

    // ========================================
    // 2. GET ALL USERS WITHOUT DEPARTMENTS
    // ========================================
    console.log("👤 Finding users without departments...");
    const usersWithoutDept = await User.find({
      $or: [{ department: null }, { department: { $exists: false } }],
    });
    console.log(
      `✅ Found ${usersWithoutDept.length} users without departments\n`,
    );

    if (usersWithoutDept.length === 0) {
      console.log("🎉 All users have departments assigned!");
      await mongoose.connection.close();
      process.exit(0);
    }

    // ========================================
    // 3. ASSIGN DEPARTMENTS TO USERS
    // ========================================
    console.log("📝 Assigning departments to users...");

    // Map users to departments based on role or random assignment
    const deptMap = {
      super_admin: departments[0]._id,
      admin: departments[0]._id,
      hr_manager:
        departments.find((d) => d.code === "HR")?._id || departments[1]?._id,
      dept_manager:
        departments.find((d) => d.code === "SWE")?._id || departments[0]._id,
      project_manager:
        departments.find((d) => d.code === "SWE")?._id || departments[0]._id,
      line_manager:
        departments.find((d) => d.code === "SWE")?._id || departments[0]._id,
      employee: departments[0]._id, // Default to first department
    };

    let updated = 0;
    for (const user of usersWithoutDept) {
      // Get the department ID based on user role
      let deptId = deptMap[user.role] || departments[0]._id;

      // For employees, distribute evenly across departments
      if (user.role === "employee") {
        const employeeIndex = updated % departments.length;
        deptId = departments[employeeIndex]._id;
      }

      // If user has a specific role that should be in a specific department
      if (user.role === "hr_manager") {
        const hrDept = departments.find(
          (d) => d.name.includes("HR") || d.code === "HR",
        );
        if (hrDept) deptId = hrDept._id;
      }

      // Update the user
      await User.updateOne({ _id: user._id }, { $set: { department: deptId } });

      updated++;
      console.log(
        `   ✅ ${user.fullName} (${user.email}) → ${user.role} → ${departments.find((d) => d._id.toString() === deptId.toString())?.name || deptId}`,
      );
    }

    console.log(`\n✅ Updated ${updated} users with departments`);

    // ========================================
    // 4. UPDATE DEPARTMENT EMPLOYEE COUNTS
    // ========================================
    console.log("\n📊 Updating department employee counts...");

    for (const dept of departments) {
      const count = await User.countDocuments({ department: dept._id });
      await Department.updateOne(
        { _id: dept._id },
        { $set: { employeeCount: count } },
      );
      console.log(`   ✅ ${dept.name}: ${count} employees`);
    }

    // ========================================
    // 5. VERIFY
    // ========================================
    console.log("\n🔍 Verifying...");
    const totalUsers = await User.countDocuments();
    const usersWithDept = await User.countDocuments({
      department: { $ne: null },
    });
    const usersWithoutDeptNow = await User.countDocuments({
      $or: [{ department: null }, { department: { $exists: false } }],
    });

    console.log(`   Total users: ${totalUsers}`);
    console.log(`   Users with department: ${usersWithDept}`);
    console.log(`   Users without department: ${usersWithoutDeptNow}`);

    if (usersWithoutDeptNow === 0) {
      console.log("\n🎉 All users now have departments assigned!");
    } else {
      console.log(
        `\n⚠️ ${usersWithoutDeptNow} users still don't have departments.`,
      );
    }

    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

fixDepartments();
