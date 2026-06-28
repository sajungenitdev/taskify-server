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
// Get all users
router.get(
  "/",
  requireRole("admin", "super_admin", "hr_manager", "employee"),
  getAllUsers,
);

// Get user by ID
router.get("/:id", requireRole("admin", "super_admin"), getUserProfile);

// Update user
router.put("/:id", requireRole("admin", "super_admin"), updateUser);

// Delete user (Super Admin only)
router.delete("/:id", requireRole("super_admin"), deleteUser);

// Change user role (Super Admin only)
router.put("/:id/role", requireRole("super_admin"), changeUserRole);

module.exports = router;
