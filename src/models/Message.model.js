// models/Message.model.js
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      trim: true,
      default: "",
    },
    type: {
      type: String,
      enum: ["text", "voice", "file", "system"],
      default: "text",
    },
    attachments: [
      {
        name: String,
        url: String,
        size: Number,
        mimeType: String,
        type: {
          type: String,
          enum: ["image", "file", "voice"],
        },
      },
    ],
    // ============================================================
    // 🔥 FIX: Added linkedTaskId for compatibility with sendMessage
    // ============================================================
    linkedTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
      index: true,
    },
    // Keep linkedTask for rich data (backward compatibility)
    linkedTask: {
      taskId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
      },
      title: String,
      status: String,
      priority: String,
      progress: Number,
      assignedTo: {
        _id: mongoose.Schema.Types.ObjectId,
        fullName: String,
      },
    },
    mentions: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        name: String,
      },
    ],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    reactions: [
      {
        emoji: {
          type: String,
          required: true,
        },
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      },
    ],
    readBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isEdited: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    // ============================================================
    // 🔥 ADD THIS: Pin message
    // ============================================================
    isPinned: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
messageSchema.index({ channelId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ "mentions.userId": 1 });
messageSchema.index({ replyTo: 1 });
messageSchema.index({ "reactions.userId": 1 });
messageSchema.index({ linkedTaskId: 1 });
messageSchema.index({ isPinned: 1 }); // ✅ Added index for isPinned

const Message = mongoose.model("Message", messageSchema);

module.exports = { Message };