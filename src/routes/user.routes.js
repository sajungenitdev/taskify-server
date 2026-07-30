// routes/user.routes.js - Updated to match auth.routes.js
const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const {
  getAllUsers,
  getUserProfile,
  updateUser,
  deleteUser,
  changeUserRole,
} = require("../controllers/auth.controller");
const { User } = require("../models/User.model");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============ USER MANAGEMENT ROUTES ============
// ✅ Allow all authenticated users with role-based filtering in controller
router.get("/", authenticate, getAllUsers);
// ============ DEPARTMENT USERS ROUTE ============
// Get all users in a specific department
router.get("/department/:departmentId", async (req, res) => {
  try {
    const { departmentId } = req.params;
    
    console.log(`🔍 Fetching users for department: ${departmentId}`);
    
    // Find users in this department
    // Check both departmentId and department._id formats
    const users = await User.find({
      $or: [
        { departmentId: departmentId },
        { "department._id": departmentId },
        { department: departmentId }
      ],
      isActive: true // Only active users (if you have this field)
    }).select('_id fullName email role departmentId department avatar');
    
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
