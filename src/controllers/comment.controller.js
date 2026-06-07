const { Comment } = require("../models/Comment.model");
const { Task } = require("../models/Task.model");
const mongoose = require("mongoose");

// Get all comments for a task
const getTaskComments = async (req, res) => {
  try {
    const { id: taskId } = req.params;

    const comments = await Comment.find({ 
      taskId, 
      parentCommentId: null // Get only parent comments
    })
      .populate("author", "fullName email avatar")
      .populate({
        path: "replies",
        populate: {
          path: "author",
          select: "fullName email avatar"
        }
      })
      .sort({ createdAt: -1 });

    // Get replies separately and attach them
    const allComments = await Comment.find({ taskId })
      .populate("author", "fullName email avatar")
      .sort({ createdAt: 1 });

    // Organize comments into hierarchy
    const commentMap = {};
    const rootComments = [];

    allComments.forEach(comment => {
      commentMap[comment._id] = comment;
      comment.replies = [];
    });

    allComments.forEach(comment => {
      if (comment.parentCommentId) {
        if (commentMap[comment.parentCommentId]) {
          commentMap[comment.parentCommentId].replies.push(comment);
        }
      } else {
        rootComments.push(comment);
      }
    });

    res.json({
      success: true,
      data: rootComments,
      count: rootComments.length,
    });
  } catch (error) {
    console.error("Get task comments error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Add a comment to a task
const addComment = async (req, res) => {
  try {
    const { id: taskId } = req.params;
    const { content, parentCommentId } = req.body;

    // Verify task exists
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const comment = await Comment.create({
      taskId,
      content,
      author: req.user._id,
      parentCommentId: parentCommentId || null,
    });

    const populatedComment = await Comment.findById(comment._id)
      .populate("author", "fullName email avatar");

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: populatedComment,
    });
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update a comment
const updateComment = async (req, res) => {
  try {
    const { id: taskId, commentId } = req.params;
    const { content } = req.body;

    const comment = await Comment.findOne({ _id: commentId, taskId });
    
    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }

    // Check if user is the author or has admin role
    if (comment.author.toString() !== req.user._id.toString() && 
        !["admin", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Unauthorized to edit this comment" });
    }

    comment.content = content;
    comment.isEdited = true;
    comment.editedAt = new Date();
    await comment.save();

    const updatedComment = await Comment.findById(commentId)
      .populate("author", "fullName email avatar");

    res.json({
      success: true,
      message: "Comment updated successfully",
      data: updatedComment,
    });
  } catch (error) {
    console.error("Update comment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delete a comment
const deleteComment = async (req, res) => {
  try {
    const { id: taskId, commentId } = req.params;

    const comment = await Comment.findOne({ _id: commentId, taskId });
    
    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }

    // Check if user is the author or has admin role
    if (comment.author.toString() !== req.user._id.toString() && 
        !["admin", "super_admin", "dept_manager"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Unauthorized to delete this comment" });
    }

    // Delete all replies to this comment as well
    await Comment.deleteMany({ parentCommentId: commentId });
    await comment.deleteOne();

    res.json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error("Delete comment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Like/unlike a comment
const toggleCommentLike = async (req, res) => {
  try {
    const { id: taskId, commentId } = req.params;
    const userId = req.user._id;

    const comment = await Comment.findOne({ _id: commentId, taskId });
    
    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }

    const likeIndex = comment.likes.indexOf(userId);
    
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
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getTaskComments,
  addComment,
  updateComment,
  deleteComment,
  toggleCommentLike,
};