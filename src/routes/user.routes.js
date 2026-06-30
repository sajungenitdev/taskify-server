// routes/user.routes.js
const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const {
  getAllUsers,
  getUserProfile,
  updateUser,
  deleteUser,
  changeUserRole,
} = require("../controllers/auth.controller");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============ USER MANAGEMENT ROUTES ============

// Get all users - Allow all authenticated users with role-based filtering
router.get(
  "/",
  authenticate, // Just authenticate, let the controller handle filtering
  getAllUsers,
);

// Get user by ID - Only admins can view other users' full profiles
router.get(
  "/:id",
  requireRole("admin", "super_admin", "hr_manager"),
  getUserProfile,
);

// Update user
router.put(
  "/:id",
  requireRole("admin", "super_admin", "hr_manager"),
  updateUser,
);

// Delete user (Super Admin only)
router.delete("/:id", requireRole("super_admin"), deleteUser);

// Change user role (Super Admin only)
router.put("/:id/role", requireRole("super_admin"), changeUserRole);

module.exports = router;
