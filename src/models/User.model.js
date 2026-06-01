const mongoose = require("mongoose");

const userRoles = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  HR_MANAGER: "hr_manager",
  DEPT_MANAGER: "dept_manager",
  PROJECT_MANAGER: "project_manager",
  LINE_MANAGER: "line_manager",
  EMPLOYEE: "employee",
};

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    employeeId: { type: String, required: true, unique: true },
    phoneNumber: { type: String, trim: true },
    profilePhoto: { type: String },
    role: {
      type: String,
      enum: Object.values(userRoles),
      default: userRoles.EMPLOYEE,
    },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    dailyHoursTarget: { type: Number, enum: [6, 7, 8], default: 8 },
    firstLogin: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },

    // ========== NEW PROFILE FIELDS ==========
    bio: { type: String, maxlength: 500, default: "" },
    position: { type: String, default: "" },
    location: { type: String, default: "" },
    website: { type: String, default: "" },

    socialLinks: {
      linkedin: { type: String, default: "" },
      github: { type: String, default: "" },
      twitter: { type: String, default: "" },
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
    },

    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      country: { type: String, default: "" },
      zipCode: { type: String, default: "" },
    },

    emergencyContact: {
      name: { type: String, default: "" },
      relationship: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
    },

    skills: [{ type: String }],
    languages: [{ type: String }],

    achievements: [
      {
        title: { type: String },
        date: { type: String },
        description: { type: String },
      },
    ],

    notificationPreferences: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      desktop: { type: Boolean, default: false },
      taskReminder: { type: Boolean, default: true },
      deadlineAlert: { type: Boolean, default: true },
      teamUpdate: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

module.exports = { User: mongoose.model("User", userSchema), userRoles };
