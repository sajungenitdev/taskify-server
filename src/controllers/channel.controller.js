// controllers/channel.controller.js
const { Channel } = require("../models/Channel.model");
const { Message } = require("../models/Message.model");
const { User } = require("../models/User.model");
const { Notification } = require("../models/Notification.model");
const { emitToChannel, emitToUser, emitToAll } = require("../socket/index");

// ============================================================
// CREATE CHANNEL
// ============================================================
const createChannel = async (req, res) => {
    try {
        const { name, type, description, members, projectId } = req.body;
        const currentUserId = req.user._id;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Channel name is required",
            });
        }

        const channelType = type || "channel";

        // For direct chats, check if a DM channel already exists between these users
        if (channelType === "direct" && Array.isArray(members) && members.length > 0) {
            const targetUserId = members[0];
            const existingDM = await Channel.findOne({
                type: "direct",
                isArchived: false,
                $and: [
                    { "members.userId": currentUserId },
                    { "members.userId": targetUserId },
                ],
            })
                .populate("members.userId", "fullName email avatar onlineStatus role")
                .populate("createdBy", "fullName email");

            if (existingDM) {
                return res.status(200).json({
                    success: true,
                    message: "Existing direct channel found",
                    data: existingDM,
                });
            }
        } else {
            // For normal channels, verify name uniqueness for active channels
            const existingChannel = await Channel.findOne({
                name: name.toLowerCase().trim(),
                isArchived: false,
            });

            if (existingChannel) {
                return res.status(400).json({
                    success: false,
                    message: "Channel with this name already exists",
                });
            }
        }

        const memberList = [
            {
                userId: currentUserId,
                role: "admin",
            },
        ];

        if (members && Array.isArray(members)) {
            const uniqueMembers = [...new Set(members)];
            for (const targetId of uniqueMembers) {
                if (targetId && targetId.toString() !== currentUserId.toString()) {
                    memberList.push({
                        userId: targetId,
                        role: "member",
                    });
                }
            }
        }

        const iconMap = {
            channel: { iconType: "building", iconBg: "#4F46E5" },
            project: { iconType: "box", iconBg: "#7C3AED" },
            direct: { iconType: "laptop", iconBg: "#0D9488" },
        };

        const channel = new Channel({
            name: name.toLowerCase().trim(),
            type: channelType,
            description: description || "",
            members: memberList,
            createdBy: currentUserId,
            projectId: projectId || null,
            iconType: iconMap[channelType]?.iconType || "building",
            iconBg: iconMap[channelType]?.iconBg || "#4F46E5",
        });

        await channel.save();

        const populatedChannel = await Channel.findById(channel._id)
            .populate("members.userId", "fullName email avatar onlineStatus role")
            .populate("createdBy", "fullName email");

        // 🔥 CRITICAL: Force active sockets of all participants to join this channel room immediately
        const io = req.app.get("io");
        if (io) {
            populatedChannel.members.forEach((m) => {
                const memberIdStr = m.userId?._id
                    ? m.userId._id.toString()
                    : m.userId.toString();
                io.in(`user-${memberIdStr}`).socketsJoin(`channel-${channel._id.toString()}`);
            });
        }

        // Broadcast globally so channels lists update
        emitToAll("channel:created", {
            channel: populatedChannel,
        });

        // Notify each member directly to update UI instantly without reload
        for (const member of populatedChannel.members) {
            const memberIdStr = member.userId?._id
                ? member.userId._id.toString()
                : member.userId.toString();

            emitToUser(memberIdStr, "channel:added", {
                channelId: channel._id.toString(),
                channelName: channel.name,
                channel: populatedChannel,
            });
        }

        res.status(201).json({
            success: true,
            message: "Channel created successfully",
            data: populatedChannel,
        });
    } catch (error) {
        console.error("Error creating channel:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create channel",
            error: error.message,
        });
    }
};

// ============================================================
// GET USER CHANNELS
// ============================================================
const getUserChannels = async (req, res) => {
    try {
        const currentUserId = req.user._id;

        const channels = await Channel.find({
            "members.userId": currentUserId,
            isArchived: false,
        })
            .populate("members.userId", "fullName email avatar onlineStatus role")
            .populate("createdBy", "fullName email")
            .populate({
                path: "lastMessage",
                populate: {
                    path: "senderId",
                    select: "fullName email avatar",
                },
            })
            .sort({ updatedAt: -1 });

        const formattedChannels = channels.map((channel) => {
            const channelObj = channel.toJSON();

            let lastMessage = null;
            if (channel.lastMessage) {
                lastMessage = {
                    content: channel.lastMessage.content,
                    createdAt: channel.lastMessage.createdAt,
                    senderId: {
                        fullName: channel.lastMessage.senderId?.fullName || "Unknown",
                    },
                };
            }

            return {
                ...channelObj,
                lastMessage,
            };
        });

        res.status(200).json({
            success: true,
            data: formattedChannels,
            count: formattedChannels.length,
        });
    } catch (error) {
        console.error("Error fetching channels:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch channels",
            error: error.message,
        });
    }
};

// ============================================================
// GET CHANNEL BY ID
// ============================================================
const getChannelById = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user._id;

        const channel = await Channel.findOne({
            _id: id,
            isArchived: false,
        })
            .populate("members.userId", "fullName email avatar onlineStatus role")
            .populate("createdBy", "fullName email")
            .populate("projectId", "name code");

        if (!channel) {
            return res.status(404).json({
                success: false,
                message: "Channel not found",
            });
        }

        const isMember = channel.members.some(
            (m) => m.userId._id.toString() === currentUserId.toString()
        );

        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this channel",
            });
        }

        res.status(200).json({
            success: true,
            data: channel,
        });
    } catch (error) {
        console.error("Error fetching channel:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch channel",
            error: error.message,
        });
    }
};

// ============================================================
// UPDATE CHANNEL
// ============================================================
const updateChannel = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, topic, avatar, iconType, iconBg } = req.body;
        const currentUserId = req.user._id;

        const channel = await Channel.findById(id);
        if (!channel) {
            return res.status(404).json({
                success: false,
                message: "Channel not found",
            });
        }

        const userMember = channel.members.find(
            (m) => m.userId.toString() === currentUserId.toString()
        );

        if (
            !userMember ||
            (userMember.role !== "admin" &&
                channel.createdBy.toString() !== currentUserId.toString())
        ) {
            return res.status(403).json({
                success: false,
                message: "Only admins can update channel settings",
            });
        }

        if (name) channel.name = name.toLowerCase().replace(/\s+/g, "-");
        if (description !== undefined) channel.description = description;
        if (topic !== undefined) channel.topic = topic;
        if (avatar) channel.avatar = avatar;
        if (iconType) channel.iconType = iconType;
        if (iconBg) channel.iconBg = iconBg;

        await channel.save();

        const populatedChannel = await Channel.findById(channel._id)
            .populate("members.userId", "fullName email avatar onlineStatus role")
            .populate("createdBy", "fullName email");

        emitToChannel(channel._id.toString(), "channel:updated", {
            channelId: channel._id.toString(),
            updates: {
                name: channel.name,
                description: channel.description,
                topic: channel.topic,
                avatar: channel.avatar,
                iconType: channel.iconType,
                iconBg: channel.iconBg,
            },
        });

        res.status(200).json({
            success: true,
            message: "Channel updated successfully",
            data: populatedChannel,
        });
    } catch (error) {
        console.error("Error updating channel:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update channel",
            error: error.message,
        });
    }
};

// ============================================================
// DELETE CHANNEL
// ============================================================
const deleteChannel = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user._id;

        const channel = await Channel.findById(id);
        if (!channel) {
            return res.status(404).json({
                success: false,
                message: "Channel not found",
            });
        }

        if (channel.createdBy.toString() !== currentUserId.toString()) {
            const userMember = channel.members.find(
                (m) => m.userId.toString() === currentUserId.toString()
            );
            if (!userMember || userMember.role !== "admin") {
                return res.status(403).json({
                    success: false,
                    message: "Only channel creator or admin can delete this channel",
                });
            }
        }

        channel.isArchived = true;
        await channel.save();

        emitToChannel(id.toString(), "channel:deleted", {
            channelId: id.toString(),
            channelName: channel.name,
        });

        res.status(200).json({
            success: true,
            message: "Channel archived successfully",
        });
    } catch (error) {
        console.error("Error deleting channel:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete channel",
            error: error.message,
        });
    }
};

// ============================================================
// JOIN CHANNEL
// ============================================================
const joinChannel = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user._id;

        const channel = await Channel.findById(id);
        if (!channel) {
            return res.status(404).json({
                success: false,
                message: "Channel not found",
            });
        }

        const isMember = channel.members.some(
            (m) => m.userId.toString() === currentUserId.toString()
        );

        if (isMember) {
            return res.status(400).json({
                success: false,
                message: "You are already a member of this channel",
            });
        }

        channel.members.push({
            userId: currentUserId,
            role: "member",
        });

        await channel.save();

        const populatedChannel = await Channel.findById(channel._id)
            .populate("members.userId", "fullName email avatar onlineStatus role")
            .populate("createdBy", "fullName email");

        // Connect user's live socket to room
        const io = req.app.get("io");
        if (io) {
            io.in(`user-${currentUserId.toString()}`).socketsJoin(`channel-${channel._id.toString()}`);
        }

        emitToChannel(channel._id.toString(), "channel:member_joined", {
            channelId: channel._id.toString(),
            userId: currentUserId.toString(),
            user: req.user,
        });

        res.status(200).json({
            success: true,
            message: "Joined channel successfully",
            data: populatedChannel,
        });
    } catch (error) {
        console.error("Error joining channel:", error);
        res.status(500).json({
            success: false,
            message: "Failed to join channel",
            error: error.message,
        });
    }
};

// ============================================================
// LEAVE CHANNEL
// ============================================================
const leaveChannel = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user._id;

        const channel = await Channel.findById(id);
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
            return res.status(400).json({
                success: false,
                message: "You are not a member of this channel",
            });
        }

        if (channel.createdBy.toString() === currentUserId.toString()) {
            const otherAdmin = channel.members.find(
                (m) =>
                    m.userId.toString() !== currentUserId.toString() && m.role === "admin"
            );

            if (otherAdmin) {
                channel.createdBy = otherAdmin.userId;
            } else if (channel.members.length > 1) {
                const otherMember = channel.members.find(
                    (m) => m.userId.toString() !== currentUserId.toString()
                );
                if (otherMember) {
                    channel.createdBy = otherMember.userId;
                    otherMember.role = "admin";
                }
            } else {
                await Channel.findByIdAndDelete(id);
                return res.status(200).json({
                    success: true,
                    message: "Channel deleted as you were the only member",
                });
            }
        }

        channel.members = channel.members.filter(
            (m) => m.userId.toString() !== currentUserId.toString()
        );

        await channel.save();

        // Remove socket from room
        const io = req.app.get("io");
        if (io) {
            io.in(`user-${currentUserId.toString()}`).socketsLeave(`channel-${channel._id.toString()}`);
        }

        emitToChannel(channel._id.toString(), "channel:member_left", {
            channelId: channel._id.toString(),
            userId: currentUserId.toString(),
        });
        emitToUser(currentUserId.toString(), "channel:left", {
            channelId: channel._id.toString(),
            channelName: channel.name,
        });

        res.status(200).json({
            success: true,
            message: "Left channel successfully",
        });
    } catch (error) {
        console.error("Error leaving channel:", error);
        res.status(500).json({
            success: false,
            message: "Failed to leave channel",
            error: error.message,
        });
    }
};

// ============================================================
// INVITE USERS
// ============================================================
const inviteUsers = async (req, res) => {
    try {
        const { id } = req.params;
        const { userIds } = req.body;
        const currentUserId = req.user._id;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide user IDs to invite",
            });
        }

        const channel = await Channel.findById(id);
        if (!channel) {
            return res.status(404).json({
                success: false,
                message: "Channel not found",
            });
        }

        const userMember = channel.members.find(
            (m) => m.userId.toString() === currentUserId.toString()
        );

        if (!userMember || userMember.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Only admins can invite users",
            });
        }

        const existingMemberIds = channel.members.map((m) => m.userId.toString());
        const newMembers = [];
        const alreadyMembers = [];

        for (const targetId of userIds) {
            if (existingMemberIds.includes(targetId)) {
                alreadyMembers.push(targetId);
                continue;
            }

            const userDoc = await User.findById(targetId);
            if (!userDoc) continue;

            channel.members.push({
                userId: targetId,
                role: "member",
            });
            newMembers.push(targetId);
        }

        await channel.save();

        const populatedChannel = await Channel.findById(channel._id)
            .populate("members.userId", "fullName email avatar onlineStatus role")
            .populate("createdBy", "fullName email");

        // Auto-join new members' active sockets to channel room immediately
        const io = req.app.get("io");
        if (io) {
            newMembers.forEach((memberId) => {
                io.in(`user-${memberId.toString()}`).socketsJoin(`channel-${channel._id.toString()}`);
            });
        }

        emitToChannel(channel._id.toString(), "channel:members_updated", {
            channelId: channel._id.toString(),
            newMembers: populatedChannel.members.filter((m) =>
                newMembers.includes(m.userId._id.toString())
            ),
        });

        for (const targetId of newMembers) {
            emitToUser(targetId.toString(), "channel:added", {
                channelId: channel._id.toString(),
                channelName: channel.name,
                channel: populatedChannel,
            });

            const notification = await Notification.createChannelInvite({
                userId: targetId,
                channelId: channel._id,
                channelName: channel.name,
                invitedBy: req.user.fullName,
                invitedByUserId: currentUserId,
            });

            if (notification) {
                emitToUser(targetId.toString(), "notification:new", notification);
            }
        }

        res.status(200).json({
            success: true,
            message: `${newMembers.length} users invited successfully`,
            data: {
                newMembers,
                alreadyMembers,
                channel: populatedChannel,
            },
        });
    } catch (error) {
        console.error("Error inviting users:", error);
        res.status(500).json({
            success: false,
            message: "Failed to invite users",
            error: error.message,
        });
    }
};

// ============================================================
// REMOVE USER
// ============================================================
const removeUser = async (req, res) => {
    try {
        const { id, userId } = req.params;
        const currentUserId = req.user._id;

        const channel = await Channel.findById(id);
        if (!channel) {
            return res.status(404).json({
                success: false,
                message: "Channel not found",
            });
        }

        const currentUserMember = channel.members.find(
            (m) => m.userId.toString() === currentUserId.toString()
        );

        if (!currentUserMember || currentUserMember.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Only admins can remove users",
            });
        }

        if (userId === currentUserId.toString()) {
            return res.status(400).json({
                success: false,
                message: "You cannot remove yourself from the channel",
            });
        }

        if (channel.createdBy.toString() === userId) {
            return res.status(400).json({
                success: false,
                message: "Cannot remove the channel creator",
            });
        }

        channel.members = channel.members.filter(
            (m) => m.userId.toString() !== userId
        );

        await channel.save();

        // Remove socket from room
        const io = req.app.get("io");
        if (io) {
            io.in(`user-${userId.toString()}`).socketsLeave(`channel-${channel._id.toString()}`);
        }

        emitToChannel(channel._id.toString(), "channel:member_removed", {
            channelId: channel._id.toString(),
            userId: userId.toString(),
        });
        emitToUser(userId.toString(), "channel:removed", {
            channelId: channel._id.toString(),
            channelName: channel.name,
        });

        res.status(200).json({
            success: true,
            message: "User removed from channel",
        });
    } catch (error) {
        console.error("Error removing user:", error);
        res.status(500).json({
            success: false,
            message: "Failed to remove user",
            error: error.message,
        });
    }
};

// ============================================================
// GET CHANNEL MEMBERS
// ============================================================
const getChannelMembers = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user._id;

        const channel = await Channel.findById(id)
            .populate("members.userId", "fullName email avatar onlineStatus role")
            .populate("createdBy", "fullName email");

        if (!channel) {
            return res.status(404).json({
                success: false,
                message: "Channel not found",
            });
        }

        const isMember = channel.members.some(
            (m) => m.userId._id.toString() === currentUserId.toString()
        );

        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this channel",
            });
        }

        const onlineCount = channel.members.filter(
            (m) => m.userId?.onlineStatus === "online"
        ).length;

        res.status(200).json({
            success: true,
            data: {
                members: channel.members,
                total: channel.members.length,
                online: onlineCount,
                createdBy: channel.createdBy,
            },
        });
    } catch (error) {
        console.error("Error getting channel members:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get channel members",
            error: error.message,
        });
    }
};

// ============================================================
// PINNED FILES
// ============================================================
const getPinnedFiles = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user._id;

        const channel = await Channel.findById(id);
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

        res.status(200).json({
            success: true,
            data: channel.pinnedFiles || [],
        });
    } catch (error) {
        console.error("Error fetching pinned files:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch pinned files",
            error: error.message,
        });
    }
};

const addPinnedFile = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, url, size, type } = req.body;
        const currentUserId = req.user._id;

        const channel = await Channel.findById(id);
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

        channel.pinnedFiles.push({
            name,
            url,
            size,
            type,
            uploadedBy: {
                _id: currentUserId,
                fullName: req.user.fullName,
            },
        });

        await channel.save();

        res.status(200).json({
            success: true,
            message: "File pinned successfully",
            data: channel.pinnedFiles,
        });
    } catch (error) {
        console.error("Error adding pinned file:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add pinned file",
            error: error.message,
        });
    }
};

const removePinnedFile = async (req, res) => {
    try {
        const { id, fileId } = req.params;
        const currentUserId = req.user._id;

        const channel = await Channel.findById(id);
        if (!channel) {
            return res.status(404).json({
                success: false,
                message: "Channel not found",
            });
        }

        const isAdmin = channel.members.some(
            (m) => m.userId.toString() === currentUserId.toString() && m.role === "admin"
        );

        if (!isAdmin && channel.createdBy.toString() !== currentUserId.toString()) {
            return res.status(403).json({
                success: false,
                message: "Only admins can remove pinned files",
            });
        }

        channel.pinnedFiles = channel.pinnedFiles.filter(
            (f) => f._id.toString() !== fileId
        );

        await channel.save();

        res.status(200).json({
            success: true,
            message: "Pinned file removed successfully",
            data: channel.pinnedFiles,
        });
    } catch (error) {
        console.error("Error removing pinned file:", error);
        res.status(500).json({
            success: false,
            message: "Failed to remove pinned file",
            error: error.message,
        });
    }
};

// ============================================================
// LINKED TASKS
// ============================================================
const getLinkedTasks = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user._id;

        const channel = await Channel.findById(id);
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

        res.status(200).json({
            success: true,
            data: channel.linkedTasks || [],
        });
    } catch (error) {
        console.error("Error fetching linked tasks:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch linked tasks",
            error: error.message,
        });
    }
};

const linkTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { taskId, title, status, assignedTo } = req.body;
        const currentUserId = req.user._id;

        const channel = await Channel.findById(id);
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

        channel.linkedTasks.push({
            taskId,
            title,
            status,
            assignedTo: {
                _id: assignedTo?._id || null,
                fullName: assignedTo?.fullName || "Unassigned",
            },
        });

        await channel.save();

        res.status(200).json({
            success: true,
            message: "Task linked successfully",
            data: channel.linkedTasks,
        });
    } catch (error) {
        console.error("Error linking task:", error);
        res.status(500).json({
            success: false,
            message: "Failed to link task",
            error: error.message,
        });
    }
};

const unlinkTask = async (req, res) => {
    try {
        const { id, taskId } = req.params;
        const currentUserId = req.user._id;

        const channel = await Channel.findById(id);
        if (!channel) {
            return res.status(404).json({
                success: false,
                message: "Channel not found",
            });
        }

        const isAdmin = channel.members.some(
            (m) => m.userId.toString() === currentUserId.toString() && m.role === "admin"
        );

        if (!isAdmin && channel.createdBy.toString() !== currentUserId.toString()) {
            return res.status(403).json({
                success: false,
                message: "Only admins can unlink tasks",
            });
        }

        channel.linkedTasks = channel.linkedTasks.filter(
            (t) => t.taskId.toString() !== taskId
        );

        await channel.save();

        res.status(200).json({
            success: true,
            message: "Task unlinked successfully",
            data: channel.linkedTasks,
        });
    } catch (error) {
        console.error("Error unlinking task:", error);
        res.status(500).json({
            success: false,
            message: "Failed to unlink task",
            error: error.message,
        });
    }
};

// ============================================================
// MAKE USER ADMIN
// ============================================================
const makeAdmin = async (req, res) => {
    try {
        const { id, userId } = req.params;
        const currentUserId = req.user._id;

        const channel = await Channel.findById(id);
        if (!channel) {
            return res.status(404).json({
                success: false,
                message: "Channel not found"
            });
        }

        // Check if current user is admin or creator
        const currentUserMember = channel.members.find(
            (m) => m.userId.toString() === currentUserId.toString()
        );

        if (!currentUserMember) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this channel"
            });
        }

        // Only admins and creators can make others admin
        if (currentUserMember.role !== "admin" && 
            channel.createdBy.toString() !== currentUserId.toString()) {
            return res.status(403).json({
                success: false,
                message: "Only admins can make other users admin"
            });
        }

        // Cannot make the creator admin (they already are)
        if (channel.createdBy.toString() === userId) {
            return res.status(400).json({
                success: false,
                message: "The channel creator is already an admin"
            });
        }

        // Find the target user in members
        const targetMember = channel.members.find(
            (m) => m.userId.toString() === userId
        );

        if (!targetMember) {
            return res.status(404).json({
                success: false,
                message: "User not found in this channel"
            });
        }

        // If already admin, remove admin (demote)
        if (targetMember.role === "admin") {
            targetMember.role = "member";
            await channel.save();

            // Emit socket event
            const io = req.app.get("io");
            if (io) {
                io.to(`channel-${id}`).emit("channel:member_updated", {
                    channelId: id,
                    userId: userId,
                    role: "member",
                    action: "demoted"
                });
            }

            return res.status(200).json({
                success: true,
                message: "User demoted to member",
                data: {
                    userId: userId,
                    role: "member",
                    action: "demoted"
                }
            });
        }

        // Make admin
        targetMember.role = "admin";
        await channel.save();

        // Emit socket event
        const io = req.app.get("io");
        if (io) {
            io.to(`channel-${id}`).emit("channel:member_updated", {
                channelId: id,
                userId: userId,
                role: "admin",
                action: "promoted"
            });
        }

        res.status(200).json({
            success: true,
            message: "User promoted to admin successfully",
            data: {
                userId: userId,
                role: "admin",
                action: "promoted"
            }
        });
    } catch (error) {
        console.error("Error making admin:", error);
        res.status(500).json({
            success: false,
            message: "Failed to make user admin",
            error: error.message
        });
    }
};

// ============================================================
// GET CHANNEL MEMBERS WITH ROLES
// ============================================================
const getChannelMembersWithRoles = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user._id;

        const channel = await Channel.findById(id)
            .populate("members.userId", "fullName email avatar onlineStatus role");

        if (!channel) {
            return res.status(404).json({
                success: false,
                message: "Channel not found"
            });
        }

        const isMember = channel.members.some(
            (m) => m.userId._id.toString() === currentUserId.toString()
        );

        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this channel"
            });
        }

        const currentUserMember = channel.members.find(
            (m) => m.userId._id.toString() === currentUserId.toString()
        );

        const isAdmin = currentUserMember?.role === "admin" || 
                        channel.createdBy.toString() === currentUserId.toString();

        res.status(200).json({
            success: true,
            data: {
                members: channel.members,
                total: channel.members.length,
                isAdmin: isAdmin,
                createdBy: channel.createdBy
            }
        });
    } catch (error) {
        console.error("Error fetching members with roles:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch members",
            error: error.message
        });
    }
};

module.exports = {
    createChannel,
    getUserChannels,
    getChannelById,
    updateChannel,
    deleteChannel,
    joinChannel,
    leaveChannel,
    inviteUsers,
    removeUser,
    getChannelMembers,
    getPinnedFiles,
    getLinkedTasks,
    addPinnedFile,
    removePinnedFile,
    linkTask,
    unlinkTask,
    makeAdmin,
    getChannelMembersWithRoles
};