const { Review } = require("../models/Review.model");
const { Task } = require("../models/Task.model");

// Get all reviews for a task
const getTaskReviews = async (req, res) => {
  try {
    const { id: taskId } = req.params;

    const reviews = await Review.find({ taskId })
      .populate("reviewer", "fullName email avatar")
      .populate("response.respondedBy", "fullName email")
      .sort({ createdAt: -1 });

    // Calculate average rating
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

    res.json({
      success: true,
      data: reviews,
      stats: {
        total: reviews.length,
        averageRating: averageRating.toFixed(1),
        ratingDistribution: {
          5: reviews.filter(r => r.rating === 5).length,
          4: reviews.filter(r => r.rating === 4).length,
          3: reviews.filter(r => r.rating === 3).length,
          2: reviews.filter(r => r.rating === 2).length,
          1: reviews.filter(r => r.rating === 1).length,
        },
      },
    });
  } catch (error) {
    console.error("Get task reviews error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Add a review to a task
const addReview = async (req, res) => {
  try {
    const { id: taskId } = req.params;
    const { rating, comment } = req.body;

    // Verify task exists
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    // Check if task is completed
    if (task.status !== "completed") {
      return res.status(400).json({ 
        success: false, 
        message: "Reviews can only be added to completed tasks" 
      });
    }

    // Check if user already reviewed this task
    const existingReview = await Review.findOne({ taskId, reviewer: req.user._id });
    if (existingReview) {
      return res.status(400).json({ 
        success: false, 
        message: "You have already reviewed this task" 
      });
    }

    const review = await Review.create({
      taskId,
      rating,
      comment,
      reviewer: req.user._id,
    });

    const populatedReview = await Review.findById(review._id)
      .populate("reviewer", "fullName email avatar");

    res.status(201).json({
      success: true,
      message: "Review added successfully",
      data: populatedReview,
    });
  } catch (error) {
    console.error("Add review error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update a review
const updateReview = async (req, res) => {
  try {
    const { id: taskId, reviewId } = req.params;
    const { rating, comment } = req.body;

    const review = await Review.findOne({ _id: reviewId, taskId });
    
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    // Check if user is the reviewer or admin
    if (review.reviewer.toString() !== req.user._id.toString() && 
        !["admin", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Unauthorized to update this review" });
    }

    review.rating = rating || review.rating;
    review.comment = comment || review.comment;
    await review.save();

    const updatedReview = await Review.findById(reviewId)
      .populate("reviewer", "fullName email avatar");

    res.json({
      success: true,
      message: "Review updated successfully",
      data: updatedReview,
    });
  } catch (error) {
    console.error("Update review error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delete a review
const deleteReview = async (req, res) => {
  try {
    const { id: taskId, reviewId } = req.params;

    const review = await Review.findOne({ _id: reviewId, taskId });
    
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    // Check if user is the reviewer or admin
    if (review.reviewer.toString() !== req.user._id.toString() && 
        !["admin", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Unauthorized to delete this review" });
    }

    await review.deleteOne();

    res.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Respond to a review (for managers/admins)
const respondToReview = async (req, res) => {
  try {
    const { id: taskId, reviewId } = req.params;
    const { response } = req.body;

    if (!response || !response.trim()) {
      return res.status(400).json({ success: false, message: "Response content is required" });
    }

    const review = await Review.findOne({ _id: reviewId, taskId });
    
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    // Only managers/admins can respond
    if (!["admin", "super_admin", "dept_manager"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Only managers can respond to reviews" });
    }

    review.response = {
      content: response,
      respondedBy: req.user._id,
      respondedAt: new Date(),
    };
    await review.save();

    const updatedReview = await Review.findById(reviewId)
      .populate("reviewer", "fullName email avatar")
      .populate("response.respondedBy", "fullName email");

    res.json({
      success: true,
      message: "Response added to review",
      data: updatedReview,
    });
  } catch (error) {
    console.error("Respond to review error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getTaskReviews,
  addReview,
  updateReview,
  deleteReview,
  respondToReview,
};