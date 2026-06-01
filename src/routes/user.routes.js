const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const { uploadProfile } = require("../config/multer");
const {
  getMe,
  updateMyProfile,
  uploadProfilePhoto,
  changePassword,
  getAllUsers,
  updateUser,
  deleteUser,
  changeUserRole,
  exportUsers,
  bulkImportUsers,
} = require("../controllers/auth.controller");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Self profile routes
router.get("/me", getMe);
router.put("/profile", updateMyProfile);
router.post("/profile/photo", uploadProfile, uploadProfilePhoto);
router.post("/change-password", changePassword);

// Export and Import routes
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

// Admin routes
router.get("/", requireRole("admin", "super_admin", "hr_manager"), getAllUsers);
router.get("/:id", requireRole("admin", "super_admin"), async (req, res) => {
  const { getUserProfile } = require("../controllers/auth.controller");
  return getUserProfile(req, res);
});
router.put("/:id", requireRole("admin", "super_admin"), updateUser);
router.delete("/:id", requireRole("super_admin"), deleteUser);
router.put("/:id/role", requireRole("super_admin"), changeUserRole);

module.exports = router;
