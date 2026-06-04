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
  requireRole("admin", "super_admin", "hr_manager"),
  bulkImportUsers,
);

// ============ ADMIN ROUTES ============
// Get all users
router.get("/", requireRole("admin", "super_admin", "hr_manager"), getAllUsers);

// Get user by ID
router.get("/:id", requireRole("admin", "super_admin"), getUserProfile);

// Update user
router.put("/:id", requireRole("admin", "super_admin"), updateUser);

// Delete user (Super Admin only)
router.delete("/:id", requireRole("super_admin"), deleteUser);

// Change user role (Super Admin only)
router.put("/:id/role", requireRole("super_admin"), changeUserRole);

module.exports = router;
