// const mongoose = require("mongoose");

// const taskSchema = new mongoose.Schema(
//   {
//     title: { type: String, required: true, trim: true },
//     description: { type: String, required: true },
//     project: { type: String, trim: true },
//     projectId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Project",
//       required: false,
//     },
//     assignedTo: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     assignedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     departmentId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Department",
//       required: true,
//     },
//     priority: {
//       type: String,
//       enum: ["low", "normal", "high", "urgent"],
//       default: "normal",
//     },
//     status: {
//       type: String,
//       enum: [
//         "pending",
//         "in_progress",
//         "submitted",
//         "completed",
//         "overdue",
//         "rejected",
//       ],
//       default: "pending",
//     },
//     estimatedHours: { type: Number, default: 0 },
//     actualMinutes: { type: Number, default: 0 },
//     deadline: { type: Date, required: true },
//     revisedDeadline: { type: Date },
//     // asdasdas
//     isApprovalRequired: { type: Boolean, default: false },

//     evidenceRequired: { type: Boolean, default: false },
//     evidenceUrls: [{ type: String }],
//     evidenceSubmitted: { type: Boolean, default: false },
//     evidenceSubmittedAt: { type: Date },
//     rejectionReason: { type: String, default: "" },
//     approvalNote: { type: String, default: "" },
//     isTimerRunning: { type: Boolean, default: false },
//     timerStartTime: { type: Date },
//     elapsedTime: { type: Number, default: 0 }, // in seconds
//     timeSpent: { type: Number, default: 0 }, // in hours
//     completedAt: { type: Date },

//     order: { type: Number, default: 0 },

//     extensionRequests: [
//       {
//         requestedDate: { type: Date, default: Date.now },
//         reason: String,
//         status: {
//           type: String,
//           enum: ["pending", "approved", "rejected"],
//           default: "pending",
//         },
//         approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
//       },
//     ],
//   },
//   { timestamps: true },
// );

// taskSchema.add({
//   commentsCount: { type: Number, default: 0 },
//   attachmentsCount: { type: Number, default: 0 },
//   reviewsCount: { type: Number, default: 0 },
//   averageRating: { type: Number, default: 0 },
// });

// // Indexes
// taskSchema.index({ assignedTo: 1 });
// taskSchema.index({ departmentId: 1 });
// taskSchema.index({ status: 1 });
// taskSchema.index({ deadline: 1 });
// taskSchema.index({ projectId: 1 });
// taskSchema.index({ projectId: 1, order: 1 });

// module.exports = { Task: mongoose.model("Task", taskSchema) };

const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    project: { type: String, trim: true },
    projectId: {
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
    // ✅ REMOVED: actualMinutes (not needed)
    // ✅ REMOVED: revisedDeadline (not needed)
    deadline: { type: Date, required: true },
    // ✅ ADDED: startDate (optional, for Gantt chart)
    startDate: { type: Date },
    // ✅ ADDED: progress (0-100%)
    progress: { type: Number, min: 0, max: 100, default: 0 },
    
    // 🆕 MILESTONE FIELDS
    isMilestone: { 
      type: Boolean, 
      default: false,
      description: "If true, task appears as diamond on Gantt chart",
    },
    parentTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
      description: "If set, this task is a sub-task of parent task",
    },
    subTaskCount: {
      type: Number,
      default: 0,
      description: "Number of sub-tasks (for parent tasks)",
    },
    completedSubTaskCount: {
      type: Number,
      default: 0,
      description: "Number of completed sub-tasks (for parent tasks)",
    },
    
    // Existing fields
    isApprovalRequired: { type: Boolean, default: false },
    evidenceRequired: { type: Boolean, default: false },
    evidenceUrls: [{ type: String }],
    evidenceSubmitted: { type: Boolean, default: false },
    evidenceSubmittedAt: { type: Date },
    rejectionReason: { type: String, default: "" },
    approvalNote: { type: String, default: "" },
    isTimerRunning: { type: Boolean, default: false },
    timerStartTime: { type: Date },
    elapsedTime: { type: Number, default: 0 }, // in seconds
    timeSpent: { type: Number, default: 0 }, // in hours
    completedAt: { type: Date },

    order: { type: Number, default: 0 },

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

// ============================================
// 🆕 MIDDLEWARE: Auto-update progress for milestones
// ============================================
taskSchema.pre('save', function(next) {
  // If this is a milestone, auto-set properties
  if (this.isMilestone) {
    this.estimatedHours = 0;
    this.progress = 100;
    this.parentTaskId = null; // Milestone cannot be sub-task
    this.subTaskCount = 0;
    this.completedSubTaskCount = 0;
  }
  
  // If this is a regular task (not milestone)
  if (!this.isMilestone && this.progress >= 100) {
    // Auto-complete task if progress is 100
    if (this.status !== 'completed' && this.status !== 'done') {
      this.status = 'completed';
      this.completedAt = new Date();
    }
  }
  
  next();
});

// ============================================
// 🆕 MIDDLEWARE: After saving, update parent task
// ============================================
taskSchema.post('save', async function(doc) {
  // If this task has a parent, update parent's sub-task info
  if (doc.parentTaskId) {
    const parent = await mongoose.model('Task').findById(doc.parentTaskId);
    if (parent) {
      // Count all sub-tasks
      const subTasks = await mongoose.model('Task').find({ 
        parentTaskId: doc.parentTaskId 
      });
      const completed = subTasks.filter(
        st => st.status === 'completed' || st.status === 'done'
      );
      
      parent.subTaskCount = subTasks.length;
      parent.completedSubTaskCount = completed.length;
      
      // Auto-update parent progress based on sub-tasks
      if (subTasks.length > 0) {
        parent.progress = Math.round((completed.length / subTasks.length) * 100);
      }
      
      await parent.save();
    }
  }
});

// ============================================
// 🆕 VIRTUAL: Check if all sub-tasks are done
// ============================================
taskSchema.virtual('allSubTasksCompleted').get(function() {
  if (this.subTaskCount === 0) return false;
  return this.subTaskCount === this.completedSubTaskCount;
});

taskSchema.virtual('subTasksProgress').get(function() {
  if (this.subTaskCount === 0) return 0;
  return Math.round((this.completedSubTaskCount / this.subTaskCount) * 100);
});

// ============================================
// 🆕 STATIC METHOD: Find all milestones for project
// ============================================
taskSchema.statics.findMilestones = function(projectId) {
  return this.find({ 
    projectId, 
    isMilestone: true 
  }).sort({ deadline: 1 });
};

// ============================================
// 🆕 STATIC METHOD: Find sub-tasks for a task
// ============================================
taskSchema.statics.findSubTasks = function(taskId) {
  return this.find({ 
    parentTaskId: taskId,
    isMilestone: false 
  }).sort({ order: 1, createdAt: 1 });
};

// ============================================
// INDEXES (Updated)
// ============================================
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ departmentId: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ deadline: 1 });
taskSchema.index({ projectId: 1 });
taskSchema.index({ projectId: 1, order: 1 });

// 🆕 New indexes for milestone support
taskSchema.index({ isMilestone: 1, projectId: 1 });
taskSchema.index({ parentTaskId: 1 });
taskSchema.index({ isMilestone: 1, status: 1 });
taskSchema.index({ progress: 1 });

// Enable virtuals in JSON output
taskSchema.set('toJSON', { virtuals: true });
taskSchema.set('toObject', { virtuals: true });

module.exports = { Task: mongoose.model("Task", taskSchema) };