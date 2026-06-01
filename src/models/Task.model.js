const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    project: { type: String, trim: true },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },
    status: {
      type: String,
      enum: [
        "pending",
        "in_progress",
        "submitted",
        "completed",
        "overdue",
        "rejected",
      ],
      default: "pending",
    },
    estimatedHours: { type: Number, default: 0 },
    actualMinutes: { type: Number, default: 0 },
    deadline: { type: Date, required: true },
    revisedDeadline: { type: Date },
    isApprovalRequired: { type: Boolean, default: false },
    evidenceRequired: { type: Boolean, default: false },
    evidenceUrls: [{ type: String }],
    extensionRequests: [
      {
        requestedDate: { type: Date, default: Date.now },
        reason: String,
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],
  },
  { timestamps: true },
);

// Indexes for better query performance
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ departmentId: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ deadline: 1 });

module.exports = { Task: mongoose.model("Task", taskSchema) };
