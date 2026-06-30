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
    // ========== BASIC INFORMATION ==========
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    employeeId: {
      type: String,
      required: true,
      unique: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: "",
    },
    profilePhoto: {
      type: String,
      default: "",
    },

    // ========== ROLE & DEPARTMENT ==========
    role: {
      type: String,
      enum: Object.values(userRoles),
      default: userRoles.EMPLOYEE,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ========== WORK SETTINGS ==========
    dailyHoursTarget: {
      type: Number,
      enum: [6, 7, 8],
      default: 8,
    },

    // ========== ONBOARDING STATUS ==========
    firstLogin: {
      type: Boolean,
      default: true,
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    onboardingStep: {
      type: Number,
      default: 1,
      min: 1,
      max: 3,
    },

    // ========== ACCOUNT STATUS ==========
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },

    // ========== PASSWORD RESET ==========
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },

    // ========== PROFILE INFORMATION ==========
    position: {
      type: String,
      default: "",
    },
    location: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      maxlength: 500,
      default: "",
    },
    website: {
      type: String,
      default: "",
    },

    // ========== SOCIAL LINKS ==========
    socialLinks: {
      linkedin: { type: String, default: "" },
      github: { type: String, default: "" },
      twitter: { type: String, default: "" },
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
    },

    // ========== ADDRESS ==========
    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      country: { type: String, default: "" },
      zipCode: { type: String, default: "" },
    },

    // ========== EMERGENCY CONTACT ==========
    emergencyContact: {
      name: { type: String, default: "" },
      relationship: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
    },

    // ========== SKILLS & LANGUAGES ==========
    skills: [{ type: String }],
    languages: [{ type: String }],

    // ========== ACHIEVEMENTS ==========
    achievements: [
      {
        title: { type: String },
        date: { type: String },
        description: { type: String },
      },
    ],

    // ========== WORK HOURS SETTINGS ==========
    workSettings: {
      dailyHoursTarget: {
        type: Number,
        default: 8,
        min: 1,
        max: 24,
      },
      weeklyHoursTarget: {
        type: Number,
        default: 40,
        min: 5,
        max: 168,
      },
      startTime: {
        type: String,
        default: "09:00",
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
      },
      endTime: {
        type: String,
        default: "18:00",
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
      },
      breakDuration: {
        type: Number,
        default: 60,
        min: 0,
        max: 180,
      },
      workDays: {
        type: [String],
        enum: [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ],
        default: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      },
      timezone: {
        type: String,
        default: "UTC+06:00",
      },
      overtimeThreshold: {
        type: Number,
        default: 2,
        min: 0,
        max: 24,
      },
    },

    // ========== NOTIFICATION PREFERENCES ==========
    notificationPreferences: {
      // Channel preferences
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      desktop: { type: Boolean, default: false },

      // Notification types
      taskReminder: { type: Boolean, default: true },
      taskReminderTime: {
        type: String,
        default: "09:00",
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
      },
      deadlineAlert: { type: Boolean, default: true },
      leaveApprovals: { type: Boolean, default: true },
      teamUpdate: { type: Boolean, default: true },
      dailyDigest: { type: Boolean, default: true },
      weeklyReport: { type: Boolean, default: true },
      mentionNotifications: { type: Boolean, default: true },
      commentNotifications: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ========== VIRTUAL FIELDS ==========
// Get full name for display
userSchema.virtual("displayName").get(function () {
  return this.fullName || this.email;
});

// Get department name
userSchema.virtual("departmentName").get(function () {
  return this.departmentId?.name || "Not Assigned";
});

// Check if user is admin
userSchema.virtual("isAdmin").get(function () {
  return ["super_admin", "admin", "hr_manager"].includes(this.role);
});

// Check if user is manager
userSchema.virtual("isManager").get(function () {
  return ["dept_manager", "project_manager", "line_manager"].includes(
    this.role,
  );
});

// ========== INDEXES ==========
userSchema.index({ email: 1 });
userSchema.index({ employeeId: 1 });
userSchema.index({ departmentId: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ firstLogin: 1 });
userSchema.index({ onboardingCompleted: 1 });

// ========== METHODS ==========
userSchema.methods.toProfileJSON = function () {
  return {
    _id: this._id,
    fullName: this.fullName,
    email: this.email,
    employeeId: this.employeeId,
    phoneNumber: this.phoneNumber,
    profilePhoto: this.profilePhoto,
    role: this.role,
    position: this.position,
    location: this.location,
    bio: this.bio,
    website: this.website,
    departmentId: this.departmentId,
    socialLinks: this.socialLinks,
    address: this.address,
    emergencyContact: this.emergencyContact,
    skills: this.skills,
    languages: this.languages,
    achievements: this.achievements,
    workSettings: this.workSettings,
    notificationPreferences: this.notificationPreferences,
    onboardingCompleted: this.onboardingCompleted,
    isActive: this.isActive,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

// ========== STATIC METHODS ==========
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findActive = function () {
  return this.find({ isActive: true });
};

userSchema.statics.findOnboardingIncomplete = function () {
  return this.find({ onboardingCompleted: false, firstLogin: true });
};

// ========== FIX: Check if model exists before creating ==========
let User;
try {
  // Try to get existing model
  User = mongoose.model("User");
} catch (error) {
  // Model doesn't exist, create it
  User = mongoose.model("User", userSchema);
}

module.exports = {
  User,
  userRoles,
};
