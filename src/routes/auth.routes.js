const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const { uploadProfile } = require("../config/multer");
const {
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
} = require("../controllers/auth.controller");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============ SELF PROFILE ROUTES ============
router.get("/me", getMe);
router.put("/profile", updateMyProfile);  // ✅ This is the route you need
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

// ============ ADMIN ROUTES ============
// Get all users
router.get(
  "/users",
  requireRole("admin", "super_admin", "hr_manager", "employee"),
  getAllUsers,
);

// Get user by ID
router.get("/users/:id", requireRole("admin", "super_admin"), getUserProfile);

// Update user
router.put("/users/:id", requireRole("admin", "super_admin"), updateUser);

// Delete user (Super Admin only)
router.delete("/users/:id", requireRole("super_admin"), deleteUser);

// Change user role (Super Admin only)
router.put("/users/:id/role", requireRole("super_admin"), changeUserRole);

module.exports = router;