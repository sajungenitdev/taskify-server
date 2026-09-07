// models/Channel.model.js
const mongoose = require("mongoose");

const channelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    type: {
      type: String,
      enum: ["channel", "project", "direct"],
      default: "channel",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    topic: {
      type: String,
      trim: true,
      default: "",
    },
    avatar: {
      type: String,
      default: null,
    },
    iconType: {
      type: String,
      enum: ["building", "laptop", "briefcase", "receipt", "box", "file"],
      default: "building",
    },
    iconBg: {
      type: String,
      default: "#4F46E5",
    },
    members: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: ["member", "admin", "moderator"],
          default: "member",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    unreadCount: {
      type: Number,
      default: 0,
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    pinnedFiles: [
      {
        name: String,
        url: String,
        size: Number,
        type: String,
        uploadedBy: {
          _id: mongoose.Schema.Types.ObjectId,
          fullName: String,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    linkedTasks: [
      {
        taskId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Task",
        },
        title: String,
        status: String,
        assignedTo: {
          _id: mongoose.Schema.Types.ObjectId,
          fullName: String,
        },
        linkedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes
channelSchema.index({ name: 1, type: 1 });
channelSchema.index({ "members.userId": 1 });
channelSchema.index({ createdBy: 1 });
channelSchema.index({ isArchived: 1 });
channelSchema.index({ updatedAt: -1 });

// Virtual for member count
channelSchema.virtual("memberCount").get(function () {
  return this.members.length;
});

// Virtual for online members count
channelSchema.virtual("onlineCount").get(function () {
  return this.members.filter((m) => m.userId?.onlineStatus === "online").length;
});

// Ensure virtuals are included in JSON output
channelSchema.set("toJSON", { virtuals: true });
channelSchema.set("toObject", { virtuals: true });

const Channel = mongoose.model("Channel", channelSchema);

module.exports = { Channel };