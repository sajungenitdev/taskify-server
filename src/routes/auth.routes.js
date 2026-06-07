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

// Ensure uploads directory exists
const uploadDir = "uploads/profiles";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/profiles/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "profile-" + uniqueSuffix + ext);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: fileFilter,
});

// Validation rules
const loginValidation = [
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty(),
];

// ============ PUBLIC ROUTES ============
router.post("/login", rateLimiter, loginValidation, validateRequest, login);
router.get("/active-users", getActiveUsers);
router.post("/refresh-token", refreshToken);
router.post("/forgot-password", strictRateLimiter, forgotPassword);
router.post("/reset-password", strictRateLimiter, resetPassword);

// ============ PROTECTED ROUTES (require authentication) ============
router.use(authenticate);

router.get(
  "/users",
  requireRole("admin", "super_admin", "hr_manager"),
  getAllUsers,
);
router.get("/me", getMe);
router.post("/logout", logout);
router.post("/change-password", changePassword);
router.post("/complete-onboarding", completeOnboarding);
router.post(
  "/register",
  strictRateLimiter,
  requireRole("admin", "super_admin"),
  register,
);
router.put("/users/:id", requireRole("admin", "super_admin"), updateUser);
router.delete("/users/:id", requireRole("super_admin"), deleteUser);
router.put("/users/:id/role", requireRole("super_admin"), changeUserRole);
router.put("/profile", updateMyProfile);
router.post(
  "/profile/photo",
  upload.single("profilePhoto"),
  uploadProfilePhoto,
);

module.exports = router;
