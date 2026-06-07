const { Comment } = require("../models/Comment.model");
const { Task } = require("../models/Task.model");
const mongoose = require("mongoose");

// Get all comments for a task (with nested replies)
const getTaskComments = async (req, res) => {
  try {
    const { id: taskId } = req.params;

    // First, verify task exists
    const task = await Task.findById(taskId);
    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    // Get all comments for this task
    const allComments = await Comment.find({ taskId })
      .populate("author", "fullName email avatar")
      .sort({ createdAt: 1 });

    // Build nested comment structure
    const commentMap = {};
    const rootComments = [];

    allComments.forEach((comment) => {
      const commentObj = comment.toObject();
      commentMap[commentObj._id.toString()] = commentObj;
      commentMap[commentObj._id.toString()].replies = [];
    });

    allComments.forEach((comment) => {
      const commentObj = comment.toObject();
      if (commentObj.parentCommentId) {
        const parentId = commentObj.parentCommentId.toString();
        if (commentMap[parentId]) {
          commentMap[parentId].replies.push(
            commentMap[commentObj._id.toString()],
          );
        } else {
          // If parent not found, treat as root comment
          rootComments.push(commentMap[commentObj._id.toString()]);
        }
      } else {
        rootComments.push(commentMap[commentObj._id.toString()]);
      }
    });

    res.json({
      success: true,
      data: rootComments,
      count: rootComments.length,
    });
  } catch (error) {
    console.error("Get task comments error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error: " + error.message });
  }
};

// Add a comment to a task
const addComment = async (req, res) => {
  try {
    const { id: taskId } = req.params;
    const { content, parentCommentId } = req.body;

    if (!content || !content.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Comment content is required" });
    }

    // Verify task exists
    const task = await Task.findById(taskId);
    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    // If this is a reply, verify parent comment exists
    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        return res
          .status(404)
          .json({ success: false, message: "Parent comment not found" });
      }
    }

    const comment = await Comment.create({
      taskId,
      content: content.trim(),
      author: req.user._id,
      parentCommentId: parentCommentId || null,
    });

    // Increment task's comment count
    await Task.findByIdAndUpdate(taskId, {
      $inc: { commentsCount: 1 },
    });

    const populatedComment = await Comment.findById(comment._id).populate(
      "author",
      "fullName email avatar",
    );

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: populatedComment,
    });
  } catch (error) {
    console.error("Add comment error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error: " + error.message });
  }
};

// Update a comment
const updateComment = async (req, res) => {
  try {
    const { id: taskId, commentId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Comment content is required" });
    }

    const comment = await Comment.findOne({ _id: commentId, taskId });

    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }

    // Check if user is the author or has admin role
    if (
      comment.author.toString() !== req.user._id.toString() &&
      !["admin", "super_admin"].includes(req.user.role)
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized to edit this comment" });
    }

    comment.content = content.trim();
    comment.isEdited = true;
    comment.editedAt = new Date();
    await comment.save();

    const updatedComment = await Comment.findById(commentId).populate(
      "author",
      "fullName email avatar",
    );

    res.json({
      success: true,
      message: "Comment updated successfully",
      data: updatedComment,
    });
  } catch (error) {
    console.error("Update comment error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error: " + error.message });
  }
};

// Delete a comment
const deleteComment = async (req, res) => {
  try {
    const { id: taskId, commentId } = req.params;

    const comment = await Comment.findOne({ _id: commentId, taskId });

    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }

    // Check if user is the author or has admin role
    if (
      comment.author.toString() !== req.user._id.toString() &&
      !["admin", "super_admin", "dept_manager"].includes(req.user.role)
    ) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Unauthorized to delete this comment",
        });
    }

    // Count how many comments will be deleted (including replies)
    const replyCount = await Comment.countDocuments({
      parentCommentId: commentId,
    });

    // Delete all replies to this comment
    await Comment.deleteMany({ parentCommentId: commentId });
    await comment.deleteOne();

    // Update task's comment count
    await Task.findByIdAndUpdate(taskId, {
      $inc: { commentsCount: -(1 + replyCount) },
    });

    res.json({
      success: true,
      message: "Comment and its replies deleted successfully",
    });
  } catch (error) {
    console.error("Delete comment error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error: " + error.message });
  }
};

// Like/unlike a comment
const toggleCommentLike = async (req, res) => {
  try {
    const { id: taskId, commentId } = req.params;
    const userId = req.user._id;

    const comment = await Comment.findOne({ _id: commentId, taskId });

    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }

    const likeIndex = comment.likes.findIndex(
      (id) => id.toString() === userId.toString(),
    );

    if (likeIndex === -1) {
      comment.likes.push(userId);
    } else {
      comment.likes.splice(likeIndex, 1);
    }

    await comment.save();

    res.json({
      success: true,
      message: likeIndex === -1 ? "Comment liked" : "Comment unliked",
      data: { likesCount: comment.likes.length, isLiked: likeIndex === -1 },
    });
  } catch (error) {
    console.error("Toggle comment like error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error: " + error.message });
  }
};

module.exports = {
  getTaskComments,
  addComment,
  updateComment,
  deleteComment,
  toggleCommentLike,
};
