// controllers/message.controller.js
const { Message } = require("../models/Message.model");
const { Channel } = require("../models/Channel.model");
const { User } = require("../models/User.model");
const { Task } = require("../models/Task.model");
const { Notification } = require("../models/Notification.model");

// ============================================================
// SEND MESSAGE - COMPLETE & REAL-TIME READY
// ============================================================
const sendMessage = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { content, type, attachments, linkedTaskId, replyTo, mentions } = req.body;
    const userId = req.user._id;

    console.log(`📝 Sending message to channel ${channelId}:`, { content, type, attachments });

    // Check if channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found",
      });
    }

    // Check if user is a member
    const isMember = channel.members.some(
      (m) => m.userId.toString() === userId.toString()
    );
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to this channel",
      });
    }

    // Create message
    const message = new Message({
      channelId,
      senderId: userId,
      content: content || "",
      type: type || "text",
      attachments: attachments || [],
      linkedTaskId: linkedTaskId || null,
      replyTo: replyTo || null,
      mentions: mentions || [],
    });

    await message.save();

    // ✅ FIXED: Populate sender details with nested populate for replyTo
    const populatedMessage = await Message.findById(message._id)
      .populate("senderId", "fullName email avatar")
      .populate({
        path: "replyTo",
        populate: {
          path: "senderId",
          select: "fullName email avatar"
        }
      })
      .populate("mentions.userId", "fullName email");

    // Update channel lastMessage and updatedAt
    await Channel.findByIdAndUpdate(channelId, {
      lastMessage: message._id,
      updatedAt: new Date(),
    });

    // ============================================================
    // 🔥 CRITICAL: EMIT SOCKET EVENT
    // ============================================================
    const io = req.app.get("io");
    if (io) {
      console.log(`📡 Emitting message:new to channel-${channelId}`);
      console.log(`📡 Message content: ${populatedMessage.content}`);
      console.log(`📡 Sender: ${populatedMessage.senderId?.fullName}`);

      // Broadcast to ALL users in the channel room
      io.to(`channel-${channelId}`).emit("message:new", {
        message: populatedMessage,
        channelId,
        userId: userId.toString(),
      });

      console.log(`✅ Message emitted to channel-${channelId}`);
    } else {
      console.warn("⚠️ Socket.io not initialized! Check server.js");
    }

    res.status(201).json({
      success: true,
      data: populatedMessage,
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// GET CHANNEL MESSAGES
// ============================================================
const getChannelMessages = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { limit = 50, skip = 0 } = req.query;
    const currentUserId = req.user._id;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found",
      });
    }

    const isMember = channel.members.some(
      (m) => m.userId.toString() === currentUserId.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this channel",
      });
    }

    // ✅ FIXED: Populate replyTo with full sender details
    const messages = await Message.find({
      channelId,
      isDeleted: false,
    })
      .populate("senderId", "fullName email avatar")
      .populate({
        path: "replyTo",
        populate: {
          path: "senderId",
          select: "fullName email avatar"
        }
      })
      .populate("mentions.userId", "fullName")
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    // Mark messages as read
    await Message.updateMany(
      {
        channelId,
        "readBy.userId": { $ne: currentUserId },
        senderId: { $ne: currentUserId },
      },
      {
        $push: {
          readBy: {
            userId: currentUserId,
            readAt: new Date(),
          },
        },
      }
    );

    // Reverse to get chronological order
    const reversedMessages = messages.reverse();

    res.status(200).json({
      success: true,
      data: reversedMessages,
      count: reversedMessages.length,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch messages",
      error: error.message,
    });
  }
};

// ============================================================
// EDIT MESSAGE
// ============================================================
const editMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const currentUserId = req.user._id;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message content is required",
      });
    }

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    if (message.senderId.toString() !== currentUserId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own messages",
      });
    }

    message.content = content.trim();
    message.isEdited = true;
    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate("senderId", "fullName email avatar")
      .populate("replyTo", "content senderId");

    const io = req.app.get("io");
    if (io) {
      io.to(`channel-${message.channelId.toString()}`).emit("message:updated", {
        channelId: message.channelId.toString(),
        message: populatedMessage,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Message updated successfully",
      data: populatedMessage,
    });
  } catch (error) {
    console.error("Error editing message:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to edit message",
      error: error.message,
    });
  }
};

// ============================================================
// DELETE MESSAGE
// ============================================================
const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user._id;

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    const channel = await Channel.findById(message.channelId);
    const userMember = channel?.members.find(
      (m) => m.userId.toString() === currentUserId.toString()
    );

    const isAdmin = userMember?.role === "admin";
    const isSender = message.senderId.toString() === currentUserId.toString();

    if (!isSender && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own messages or be an admin",
      });
    }

    message.isDeleted = true;
    await message.save();

    const io = req.app.get("io");
    if (io) {
      io.to(`channel-${message.channelId.toString()}`).emit("message:deleted", {
        channelId: message.channelId.toString(),
        messageId: message._id.toString(),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete message",
      error: error.message,
    });
  }
};

// ============================================================
// ADD / REMOVE REACTION
// ============================================================

const addReaction = async (req, res) => {
  try {
    const { id } = req.params;  // ✅ CHANGE: Use 'id' instead of 'messageId'
    const { emoji, action } = req.body;
    const currentUserId = req.user._id;

    console.log(`📝 Adding reaction: messageId=${id}, emoji=${emoji}, userId=${currentUserId}`);

    const message = await Message.findById(id);  // ✅ Use 'id'
    if (!message) {
      console.log(`❌ Message not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    // Check if user already reacted
    const existingIndex = message.reactions.findIndex(
      r => r.emoji === emoji && r.userId.toString() === currentUserId.toString()
    );

    if (action === 'remove' || existingIndex !== -1) {
      // Remove reaction
      message.reactions = message.reactions.filter(
        r => !(r.emoji === emoji && r.userId.toString() === currentUserId.toString())
      );
      console.log(`🗑️ Removed reaction ${emoji} from message ${id}`);
    } else {
      // Add reaction
      message.reactions.push({
        emoji,
        userId: currentUserId
      });
      console.log(`➕ Added reaction ${emoji} to message ${id}`);
    }

    await message.save();
    console.log(`✅ Message reactions updated: ${message.reactions.length} reactions`);

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.to(`channel-${message.channelId}`).emit("message:reaction", {
        channelId: message.channelId,
        messageId: message._id,
        reactions: message.reactions
      });
      console.log(`📡 Emitted message:reaction to channel-${message.channelId}`);
    }

    res.status(200).json({
      success: true,
      data: message.reactions
    });
  } catch (error) {
    console.error("Error updating reaction:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update reaction",
      error: error.message
    });
  }
};

// ============================================================
// MARK MESSAGES AS READ
// ============================================================
const markMessagesAsRead = async (req, res) => {
  try {
    const { channelId } = req.params;
    const currentUserId = req.user._id;

    // 🔥 FIX: Single atomic query instead of N blocking saves
    await Message.updateMany(
      {
        channelId,
        "readBy.userId": { $ne: currentUserId },
        senderId: { $ne: currentUserId },
      },
      {
        $push: {
          readBy: {
            userId: currentUserId,
            readAt: new Date(),
          },
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Messages marked as read",
    });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark messages as read",
      error: error.message,
    });
  }
};

// controllers/message.controller.js

// ============================================================
// PIN / UNPIN MESSAGE - UPDATED to sync with Channel.pinnedFiles
// ============================================================

const pinMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user._id;

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    const channel = await Channel.findById(message.channelId);
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found"
      });
    }

    const isMember = channel.members.some(
      m => m.userId.toString() === currentUserId.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this channel"
      });
    }

    // Toggle pin status
    message.isPinned = !message.isPinned;
    await message.save();

    // ============================================================
    // 🔥 CRITICAL FIX: ALWAYS update Channel.pinnedFiles
    // ============================================================
    if (message.isPinned) {
      // Check if this message already exists in pinnedFiles
      const exists = channel.pinnedFiles.some(
        (f) => f.messageId?.toString() === message._id.toString()
      );

      if (!exists) {
        // ✅ Add to pinnedFiles - THIS IS WHAT THE SIDEBAR READS!
        await Channel.findByIdAndUpdate(message.channelId, {
          $push: {
            pinnedFiles: {
              name: message.content || "Pinned message",
              url: `/messages/${message._id}`,
              size: 0,
              type: 'message',
              messageId: message._id,
              uploadedBy: {
                _id: currentUserId,
                fullName: req.user.fullName,
              },
              uploadedAt: new Date(),
            }
          }
        });
        console.log(`✅ PINNED: Added "${message.content || 'Pinned'}" to channel.pinnedFiles`);
      }
    } else {
      // Remove from pinnedFiles when unpinned
      await Channel.findByIdAndUpdate(message.channelId, {
        $pull: {
          pinnedFiles: {
            messageId: message._id
          }
        }
      });
      console.log(`✅ UNPINNED: Removed message from channel.pinnedFiles`);
    }

    // Populate sender details
    const populatedMessage = await Message.findById(message._id)
      .populate("senderId", "fullName email avatar")
      .populate("replyTo", "content senderId")
      .populate("mentions.userId", "fullName email");

    // Emit socket events
    const io = req.app.get("io");
    if (io) {
      io.to(`channel-${message.channelId.toString()}`).emit("message:updated", {
        channelId: message.channelId.toString(),
        message: populatedMessage,
      });

      io.to(`channel-${message.channelId.toString()}`).emit("pinned:updated", {
        channelId: message.channelId.toString(),
      });
    }

    res.status(200).json({
      success: true,
      message: message.isPinned ? "Message pinned successfully" : "Message unpinned successfully",
      data: populatedMessage
    });
  } catch (error) {
    console.error("❌ Error pinning message:", error);
    res.status(500).json({
      success: false,
      message: "Failed to pin message",
      error: error.message
    });
  }
};
// ============================================================
// GET PINNED MESSAGES IN CHANNEL
// ============================================================
const getPinnedMessages = async (req, res) => {
  try {
    const { channelId } = req.params;
    const currentUserId = req.user._id;

    const Channel = require("../models/Channel.model").Channel;
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found"
      });
    }

    const isMember = channel.members.some(
      m => m.userId.toString() === currentUserId.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this channel"
      });
    }

    // ✅ FIXED: Populate replyTo with full sender details
    const messages = await Message.find({
      channelId,
      isPinned: true,
      isDeleted: false
    })
      .populate("senderId", "fullName email avatar")
      .populate({
        path: "replyTo",
        populate: {
          path: "senderId",
          select: "fullName email avatar"
        }
      })
      .populate("mentions.userId", "fullName")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: messages,
      count: messages.length
    });
  } catch (error) {
    console.error("Error fetching pinned messages:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pinned messages",
      error: error.message
    });
  }
};
const getMessageById = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user._id;

    const message = await Message.findById(id)
      .populate("senderId", "fullName email avatar")
      .populate("replyTo", "content senderId")
      .populate("mentions.userId", "fullName email");

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    // Check if user has access to the channel
    const channel = await Channel.findById(message.channelId);
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found"
      });
    }

    const isMember = channel.members.some(
      (m) => m.userId.toString() === currentUserId.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to this message"
      });
    }

    res.status(200).json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error("Error fetching message:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch message",
      error: error.message
    });
  }
};
// ============================================================
// REMOVE REACTION
// ============================================================
// controllers/message.controller.js

const removeReaction = async (req, res) => {
  try {
    const { messageId } = req.params;  // ✅ This is correct - route is /:messageId/reaction
    const { emoji } = req.body;
    const currentUserId = req.user._id;

    console.log(`🗑️ Removing reaction: messageId=${messageId}, emoji=${emoji}`);

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    // Remove the user's reaction
    message.reactions = message.reactions.filter(
      r => !(r.emoji === emoji && r.userId.toString() === currentUserId.toString())
    );

    await message.save();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.to(`channel-${message.channelId}`).emit("message:reaction", {
        channelId: message.channelId,
        messageId: message._id,
        reactions: message.reactions
      });
    }

    res.status(200).json({
      success: true,
      data: message.reactions
    });
  } catch (error) {
    console.error("Error removing reaction:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove reaction"
    });
  }
};
module.exports = {
  sendMessage,
  getChannelMessages,
  editMessage,
  deleteMessage,
  addReaction,
  markMessagesAsRead,
  pinMessage,
  getPinnedMessages,
  getMessageById,
  removeReaction
};