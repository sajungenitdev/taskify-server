const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    project: { type: String, trim: true }, // Keep for backward compatibility
    projectId: {  // ADD THIS - proper reference to Project model
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: false,
    },
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
    order: { type: Number, default: 0 }, // For task ordering within project
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

taskSchema.add({
  commentsCount: { type: Number, default: 0 },
  attachmentsCount: { type: Number, default: 0 },
  reviewsCount: { type: Number, default: 0 },
  averageRating: { type: Number, default: 0 },
});

// Indexes
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ departmentId: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ deadline: 1 });
taskSchema.index({ projectId: 1 }); // ADD THIS
taskSchema.index({ projectId: 1, order: 1 }); // Compound index

module.exports = { Task: mongoose.model("Task", taskSchema) };