const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const taskSchema = new mongoose.Schema({
  title: String,
  description: String,
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
  priority: String,
  status: String,
  estimatedHours: Number,
  deadline: Date,
});

const userSchema = new mongoose.Schema({
  email: String,
  role: String,
  _id: mongoose.Schema.Types.ObjectId,
});

const Task = mongoose.model("Task", taskSchema);
const User = mongoose.model("User", userSchema);

const seedTasks = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Check if tasks already exist
    const existingTasks = await Task.countDocuments();
    if (existingTasks > 0) {
      console.log(
        `✅ ${existingTasks} tasks already exist. No seeding needed.`,
      );
      process.exit(0);
    }

    // Get all employees
    const employees = await User.find({ role: "employee" });
    const admin = await User.findOne({ role: "admin" });

    if (employees.length === 0) {
      console.log(
        "⚠️ No employees found. Tasks will be created when users are assigned.",
      );
      process.exit(0);
    }

    const tasks = [];
    const now = new Date();

    for (const emp of employees) {
      tasks.push({
        title: `Welcome Task - Getting Started`,
        description: `Welcome to the team! Please complete your onboarding and setup.`,
        assignedTo: emp._id,
        assignedBy: admin?._id || emp._id,
        priority: "normal",
        status: "pending",
        estimatedHours: 4,
        deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      });

      tasks.push({
        title: `Review Department Guidelines`,
        description: `Please review the department guidelines and best practices document.`,
        assignedTo: emp._id,
        assignedBy: admin?._id || emp._id,
        priority: "low",
        status: "pending",
        estimatedHours: 2,
        deadline: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      });
    }

    if (tasks.length > 0) {
      await Task.insertMany(tasks);
      console.log(`✅ Created ${tasks.length} initial tasks`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

seedTasks();
