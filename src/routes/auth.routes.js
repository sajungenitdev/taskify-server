// routes/auth.routes.js - Remove multer dependency

const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
// ❌ REMOVE: const { uploadProfile } = require("../config/multer");
const {
  login,
  getMe,
  updateMyProfile,
  uploadProfilePhoto, // This will now handle base64 only
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
  completeOnboarding,
  refreshToken,
  logout,
} = require("../controllers/auth.controller");

const router = express.Router();

// ============================================================
// PUBLIC ROUTES (no authentication required)
// ============================================================
router.post("/register", register);
router.post("/login", login);
router.get("/active-users", getActiveUsers);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// ============================================================
// AUTHENTICATED ROUTES
// ============================================================
router.use(authenticate);

// ============================================================
// TOKEN MANAGEMENT
// ============================================================
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);

// ============================================================
// SELF PROFILE ROUTES
// ============================================================
router.get("/me", getMe);
router.put("/profile", updateMyProfile);
router.post("/profile/photo", uploadProfilePhoto); // ✅ Base64 only
router.post("/change-password", changePassword);

// ============================================================
// ONBOARDING
// ============================================================
router.post("/onboarding/complete", completeOnboarding);

// ============================================================
// USER MANAGEMENT ROUTES (Admin only)
// ============================================================
router.get("/users", authenticate, getAllUsers);
router.get("/users/active", authenticate, getActiveUsers);

router.get(
  "/users/:id",
  requireRole("admin", "super_admin", "hr_manager"),
  getUserProfile,
);

router.put(
  "/users/:id",
  requireRole("admin", "super_admin", "hr_manager"),
  updateUser,
);

router.delete("/users/:id", requireRole("super_admin"), deleteUser);
router.put("/users/:id/role", requireRole("super_admin"), changeUserRole);

// ============================================================
// EXPORT AND IMPORT ROUTES (Admin only)
// ============================================================
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

module.exports = router;