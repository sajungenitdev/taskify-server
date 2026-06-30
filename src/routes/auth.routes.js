// routes/auth.routes.js - Updated

const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const { uploadProfile } = require("../config/multer");
const {
  login,
  getMe,
  updateMyProfile,
  uploadProfilePhoto,
  changePassword,
  getAllUsers,
  getUserProfile,
  updateUser,
  deleteUser,
  changeUserRole,
  exportUsers,
  bulkImportUsers,
  getActiveUsers,
  register,
  forgotPassword,
  resetPassword,
} = require("../controllers/auth.controller");

const router = express.Router();

// ============ PUBLIC ROUTES (no authentication required) ============
router.post("/register", register);
router.post("/login", login);
router.get("/active-users", getActiveUsers);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// ============ ALL ROUTES BELOW REQUIRE AUTHENTICATION ============
router.use(authenticate);

// ============ SELF PROFILE ROUTES ============
router.get("/me", getMe);
router.put("/profile", updateMyProfile);
router.post("/profile/photo", uploadProfile, uploadProfilePhoto);
router.post("/change-password", changePassword);

// ============ EXPORT AND IMPORT ROUTES ============
router.get(
  "/export",
  requireRole("admin", "super_admin", "hr_manager"),
  exportUsers,
);
router.post(
  "/bulk-import",
  requireRole("admin", "super_admin", "hr_manager", "employee"),
  bulkImportUsers,
);

// ============ USER MANAGEMENT ROUTES ============
// ✅ UPDATED: Allow all authenticated users with role-based filtering in controller
router.get("/users", authenticate, getAllUsers);
router.get("/users/active", authenticate, getActiveUsers);

// Get user by ID - Only admins can view other users' full profiles
router.get(
  "/users/:id",
  requireRole("admin", "super_admin", "hr_manager"),
  getUserProfile,
);

// Update user
router.put(
  "/users/:id",
  requireRole("admin", "super_admin", "hr_manager"),
  updateUser,
);

// Delete user (Super Admin only)
router.delete("/users/:id", requireRole("super_admin"), deleteUser);

// Change user role (Super Admin only)
router.put("/users/:id/role", requireRole("super_admin"), changeUserRole);

module.exports = router;
