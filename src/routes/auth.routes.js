const express = require("express");
const { body } = require("express-validator");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  completeOnboarding,
  getAllUsers,
  getMe,
  updateUser,
  deleteUser,
  changeUserRole,
  getActiveUsers,
  updateMyProfile,
  uploadProfilePhoto,
} = require("../controllers/auth.controller");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const { validateRequest } = require("../middleware/validation.middleware");
const {
  rateLimiter,
  strictRateLimiter,
} = require("../middleware/rateLimiter.middleware");

const router = express.Router();

// ============ MULTER CONFIGURATION FOR FILE UPLOADS ============

// Ensure uploads directory exists with absolute path
const uploadsDir = path.join(process.cwd(), "uploads");
const profilesDir = path.join(uploadsDir, "profiles");

console.log("📁 Uploads directory:", uploadsDir);
console.log("📁 Profiles directory:", profilesDir);

// Create directories recursively if they don't exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("✅ Created uploads directory");
}
if (!fs.existsSync(profilesDir)) {
  fs.mkdirSync(profilesDir, { recursive: true });
  console.log("✅ Created profiles directory");
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profilesDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "profile-" + uniqueSuffix + ext);
  },
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)"));
  }
};

// Multer upload configuration
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter,
});

// ============ VALIDATION RULES ============

const loginValidation = [
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

const registerValidation = [
  body("fullName").notEmpty().withMessage("Full name is required"),
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  body("employeeId").optional(),
  body("role")
    .optional()
    .isIn([
      "super_admin",
      "admin",
      "hr_manager",
      "dept_manager",
      "project_manager",
      "line_manager",
      "employee",
    ]),
  body("departmentId").optional(),
  body("phoneNumber").optional(),
];

const changePasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters"),
];

const forgotPasswordValidation = [
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
];

const resetPasswordValidation = [
  body("token").notEmpty().withMessage("Token is required"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

const updateProfileValidation = [
  body("fullName").optional(),
  body("phoneNumber").optional(),
  body("employeeId").optional(),
  body("departmentId").optional(),
  body("bio").optional(),
  body("position").optional(),
  body("location").optional(),
];

// ============ PUBLIC ROUTES ============
router.post("/login", rateLimiter, loginValidation, validateRequest, login);
router.get("/active-users", getActiveUsers); // ✅ This route is now properly registered
router.post("/refresh-token", refreshToken);
router.post(
  "/forgot-password",
  strictRateLimiter,
  forgotPasswordValidation,
  validateRequest,
  forgotPassword,
);
router.post(
  "/reset-password",
  strictRateLimiter,
  resetPasswordValidation,
  validateRequest,
  resetPassword,
);

// ============ PROTECTED ROUTES (require authentication) ============
router.use(authenticate);

// User management routes
router.get(
  "/users",
  requireRole("admin", "super_admin", "hr_manager"),
  getAllUsers,
);
router.get("/me", getMe);
router.post("/logout", logout);
router.post(
  "/change-password",
  changePasswordValidation,
  validateRequest,
  changePassword,
);
router.post("/complete-onboarding", completeOnboarding);

// Admin only routes
router.post(
  "/register",
  strictRateLimiter,
  requireRole("admin", "super_admin"),
  registerValidation,
  validateRequest,
  register,
);
router.put("/users/:id", requireRole("admin", "super_admin"), updateUser);
router.delete("/users/:id", requireRole("super_admin"), deleteUser);
router.put("/users/:id/role", requireRole("super_admin"), changeUserRole);

// Profile routes
router.put(
  "/profile",
  updateProfileValidation,
  validateRequest,
  updateMyProfile,
);
router.post(
  "/profile/photo",
  upload.single("profilePhoto"),
  uploadProfilePhoto,
);

// ============ ERROR HANDLER FOR MULTER ============
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "FILE_TOO_LARGE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 5MB",
      });
    }
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next(error);
});

module.exports = router;
