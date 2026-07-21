// src/models/User.model.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    // Legacy single role (kept for backward compatibility)
    role: {
      type: String,
      default: "employee",
      enum: [
        "super_admin",
        "admin",
        "hr_manager",
        "dept_manager",
        "project_manager",
        "line_manager",
        "employee",
      ],
    },
    // New multiple roles support
    roles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Role",
      },
    ],
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },
    position: {
      type: String,
      trim: true,
    },
    employeeId: {
      type: String,
      unique: true,
      sparse: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
      default: "",
    },
    // Profile fields
    profile: {
      bio: { type: String, default: "" },
      address: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      country: { type: String, default: "" },
      postalCode: { type: String, default: "" },
      dateOfBirth: { type: Date },
      gender: {
        type: String,
        enum: ["male", "female", "other", ""],
        default: "",
      },
      skills: [{ type: String }],
      socialLinks: {
        linkedin: { type: String, default: "" },
        github: { type: String, default: "" },
        twitter: { type: String, default: "" },
        website: { type: String, default: "" },
      },
    },
    // Employment details
    employment: {
      joiningDate: { type: Date },
      employmentType: {
        type: String,
        enum: ["full-time", "part-time", "contract", "intern", ""],
        default: "",
      },
      workLocation: {
        type: String,
        enum: ["on-site", "hybrid", "remote", ""],
        default: "",
      },
      manager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      reportsTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
    // Account status
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPasswordChanged: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    // Notifications
    notificationPreferences: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      taskUpdates: { type: Boolean, default: true },
      projectUpdates: { type: Boolean, default: true },
      systemUpdates: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false },
    },
    // Settings
    settings: {
      theme: {
        type: String,
        enum: ["light", "dark", "system"],
        default: "system",
      },
      language: {
        type: String,
        default: "en",
      },
      timezone: {
        type: String,
        default: "UTC",
      },
      dateFormat: {
        type: String,
        default: "MM/DD/YYYY",
      },
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ roles: 1 });
userSchema.index({ department: 1 });
userSchema.index({ "employment.manager": 1 });
userSchema.index({ isActive: 1 });

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get full role names method
userSchema.methods.getRoleNames = async function () {
  if (this.roles && this.roles.length > 0) {
    await this.populate("roles");
    return this.roles.map((r) => r.name);
  }
  return [this.role];
};

// Get primary role name
userSchema.methods.getPrimaryRole = async function () {
  if (this.roles && this.roles.length > 0) {
    await this.populate("roles");
    const primaryRole = this.roles.find(
      (r) => r.code.toLowerCase() === this.role,
    );
    return primaryRole ? primaryRole.name : this.role;
  }
  return this.role;
};

module.exports = { User: mongoose.model("User", userSchema) };

// src/models/User.model.js - add this method
userSchema.methods.hasRole = function(roleCode) {
  // Check legacy role field
  if (this.role === roleCode) {
    return true;
  }
  
  // Check roles array
  if (this.roles && this.roles.length > 0) {
    // If roles are populated
    if (typeof this.roles[0] === 'object' && this.roles[0].code) {
      return this.roles.some(r => r.code.toLowerCase() === roleCode.toLowerCase());
    }
    // If roles are just ObjectIds, we need to populate first
  }
  
  return false;
};

// Add a method to check multiple roles
userSchema.methods.hasAnyRole = function(roleCodes) {
  return roleCodes.some(code => this.hasRole(code));
};