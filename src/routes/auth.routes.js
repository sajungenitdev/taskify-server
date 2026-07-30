// routes/auth.routes.js - Complete Base64 Support (No Multer)

const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const {
  login,
  getMe,
  updateMyProfile,
  uploadProfilePhoto,
  changePassword,
  changeUserPassword,
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

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (Admin only)
 * @access  Public (should be protected in production)
 */
router.post("/register", register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post("/login", login);

/**
 * @route   GET /api/auth/active-users
 * @desc    Get all active users
 * @access  Public
 */
router.get("/active-users", getActiveUsers);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post("/forgot-password", forgotPassword);

/**
 * @route   POST /api/auth/reset-password/:token
 * @desc    Reset password with token
 * @access  Public
 */
router.post("/reset-password/:token", resetPassword);

// ============================================================
// AUTHENTICATED ROUTES (all routes below require authentication)
// ============================================================
router.use(authenticate);

// ============================================================
// TOKEN MANAGEMENT
// ============================================================

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token
 * @access  Private
 */
router.post("/refresh-token", refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post("/logout", logout);

// ============================================================
// SELF PROFILE ROUTES
// ============================================================

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get("/me", getMe);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update current user profile
 * @access  Private
 */
router.put("/profile", updateMyProfile);

/**
 * @route   POST /api/auth/profile/photo
 * @desc    Upload profile photo (Base64 only)
 * @access  Private
 * @body    { profilePhoto: "data:image/jpeg;base64,..." }
 */
router.post("/profile/photo", uploadProfilePhoto);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change current user password
 * @access  Private
 */
router.post("/change-password", changePassword);

// ============================================================
// ONBOARDING
// ============================================================

/**
 * @route   POST /api/auth/onboarding/complete
 * @desc    Complete user onboarding
 * @access  Private
 */
router.post("/onboarding/complete", completeOnboarding);

// ============================================================
// USER MANAGEMENT ROUTES (Admin only)
// ============================================================

/**
 * @route   GET /api/auth/users
 * @desc    Get all users with role-based filtering
 * @access  Private
 */
router.get("/users", getAllUsers);

router.get("/users/department/:departmentId", async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { User } = require("../models/User.model");

    console.log(`🔍 Fetching users for department: ${departmentId}`);

    const users = await User.find({
      $or: [
        { department: departmentId },
        { "department._id": departmentId },
        { departmentId: departmentId }
      ],
      isActive: true
    }).select('_id fullName email role departmentId department avatar profilePhoto');

    console.log(`✅ Found ${users.length} users in department`);

    res.status(200).json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error("❌ Error fetching department users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch department users",
      error: error.message
    });
  }
});

/**
 * @route   GET /api/auth/users/active
 * @desc    Get all active users
 * @access  Private
 */
router.get("/users/active", getActiveUsers);

/**
 * @route   GET /api/auth/users/:id
 * @desc    Get user by ID
 * @access  Private (Admin, Super Admin, HR Manager only)
 */
router.get(
  "/users/:id",
  requireRole("admin", "super_admin", "hr_manager"),
  getUserProfile,
);

/**
 * @route   PUT /api/auth/users/:id
 * @desc    Update user by ID
 * @access  Private (Admin, Super Admin, HR Manager only)
 */
router.put(
  "/users/:id",
  requireRole("admin", "super_admin", "hr_manager"),
  updateUser,
);

/**
 * @route   DELETE /api/auth/users/:id
 * @desc    Delete user by ID
 * @access  Private (Super Admin only)
 */
router.delete("/users/:id", requireRole("super_admin"), deleteUser);

/**
 * @route   PUT /api/auth/users/:id/role
 * @desc    Change user role
 * @access  Private (Super Admin only)
 */
router.put("/users/:id/role", requireRole("super_admin"), changeUserRole);

// ✅ ADD THIS ROUTE - Admin can change any user's password
/**
 * @route   POST /api/auth/users/:id/change-password
 * @desc    Change user password by ID (Admin only)
 * @access  Private (Admin, Super Admin, HR Manager only)
 * @body    { newPassword: "string" }
 */
router.post(
  "/users/:id/change-password",
  requireRole("admin", "super_admin", "hr_manager"),
  changeUserPassword
);

// ============================================================
// EXPORT AND IMPORT ROUTES (Admin only)
// ============================================================

/**
 * @route   GET /api/auth/export
 * @desc    Export users data
 * @access  Private (Admin, Super Admin, HR Manager only)
 */
router.get(
  "/export",
  requireRole("admin", "super_admin", "hr_manager"),
  exportUsers,
);

/**
 * @route   POST /api/auth/bulk-import
 * @desc    Bulk import users
 * @access  Private (Admin, Super Admin, HR Manager only)
 */
router.post(
  "/bulk-import",
  requireRole("admin", "super_admin", "hr_manager"),
  bulkImportUsers,
);

module.exports = router;