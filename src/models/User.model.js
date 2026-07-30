// models/User.model.js - Add the missing fields

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
    phoneNumber: {
      type: String,
      trim: true,
    },
    // ✅ Profile photo fields
    profilePhoto: {
      type: String,
      default: "",
    },
    avatar: {
      type: String,
      default: "",
    },
    // ✅ Onboarding status
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    // ✅ Bio
    bio: {
      type: String,
      default: "",
    },
    // ✅ Location
    location: {
      type: String,
      default: "",
    },
    // ✅ Website
    website: {
      type: String,
      default: "",
    },

    // ============================================================
    // ✅ NEW FIELDS - These are missing in your model!
    // ============================================================

    // ✅ Skills - Array of strings
    skills: {
      type: [String],
      default: [],
    },

    // ✅ Languages - Array of strings
    languages: {
      type: [String],
      default: [],
    },

    // ✅ Achievements - Array of objects
    achievements: {
      type: [{
        title: { type: String, required: true },
        date: { type: String, default: "" },
        description: { type: String, required: true },
      }],
      default: [],
    },

    // ✅ Social Links - Object with specific fields
    socialLinks: {
      linkedin: { type: String, default: "" },
      github: { type: String, default: "" },
      twitter: { type: String, default: "" },
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
    },

    // ============================================================
    // END NEW FIELDS
    // ============================================================

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

    // Reset password
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },

    // Notifications
    notificationPreferences: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      desktop: { type: Boolean, default: false },
      taskReminder: { type: Boolean, default: true },
      deadlineAlert: { type: Boolean, default: true },
      teamUpdate: { type: Boolean, default: true },
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

// Indexes
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

// Methods
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.getRoleNames = async function () {
  if (this.roles && this.roles.length > 0) {
    await this.populate("roles");
    return this.roles.map((r) => r.name);
  }
  return [this.role];
};

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

userSchema.methods.hasRole = function (roleCode) {
  if (this.role === roleCode) return true;
  if (this.roles && this.roles.length > 0) {
    if (typeof this.roles[0] === 'object' && this.roles[0].code) {
      return this.roles.some(r => r.code.toLowerCase() === roleCode.toLowerCase());
    }
  }
  return false;
};

userSchema.methods.hasAnyRole = function (roleCodes) {
  return roleCodes.some(code => this.hasRole(code));
};

module.exports = { User: mongoose.model("User", userSchema) };