const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    description: {
      type: String,
      default: "",
    },
    headOfDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    employeeCount: {
      type: Number,
      default: 0,
    },
    settings: {
      workStartTime: {
        type: String,
        default: "09:00",
      },
      workEndTime: {
        type: String,
        default: "18:00",
      },
      gracePeriodMinutes: {
        type: Number,
        default: 15,
      },
      breakDurationMinutes: {
        type: Number,
        default: 60,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Additional fields for better tracking
    budget: {
      type: Number,
      default: 0,
    },
    location: {
      type: String,
      default: "",
    },
    establishedDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ========== VIRTUAL FIELDS ==========
// Get department head name
departmentSchema.virtual("headName").get(function () {
  return this.headOfDepartment?.fullName || "Not Assigned";
});

// Get department head email
departmentSchema.virtual("headEmail").get(function () {
  return this.headOfDepartment?.email || "";
});

// ========== INDEXES ==========
departmentSchema.index({ name: 1 });
departmentSchema.index({ code: 1 });
departmentSchema.index({ isActive: 1 });
departmentSchema.index({ headOfDepartment: 1 });

// ========== METHODS ==========
departmentSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.headName = this.headName;
  obj.headEmail = this.headEmail;
  return obj;
};

// ========== STATIC METHODS ==========
departmentSchema.statics.findActive = function () {
  return this.find({ isActive: true });
};

departmentSchema.statics.findByCode = function (code) {
  return this.findOne({ code: code.toUpperCase() });
};

// ========== FIX: Check if model exists before creating ==========
let Department;
try {
  // Try to get existing model
  Department = mongoose.model("Department");
} catch (error) {
  // Model doesn't exist, create it
  Department = mongoose.model("Department", departmentSchema);
}

module.exports = { Department };
