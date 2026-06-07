const express = require("express");
const { body } = require("express-validator");
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
} = require("../controllers/auth.controller");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const { validateRequest } = require("../middleware/validation.middleware");
const {
  rateLimiter,
  strictRateLimiter,
} = require("../middleware/rateLimiter.middleware");

const router = express.Router();

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

module.exports = router;
