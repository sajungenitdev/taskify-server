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
  getDemoUsers,
} = require("../controllers/auth.controller");
const { authenticate } = require("../middleware/auth.middleware");
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

// Public routes
router.post("/login", rateLimiter, loginValidation, validateRequest, login);
router.get("/demo-users", getDemoUsers);

// Protected routes (require authentication)
router.use(authenticate);

// User management routes
router.get("/users", getAllUsers);
router.get("/me", getMe);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);
router.put("/users/:id/role", changeUserRole);

// Auth routes
router.post("/logout", logout);
router.post("/change-password", changePassword);
router.post("/complete-onboarding", completeOnboarding);

// Admin only routes
router.post("/register", strictRateLimiter, register);

module.exports = router;
