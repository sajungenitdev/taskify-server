// routes/kpi.routes.js - Add error handling middleware
const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const {
  getKPIWeights,
  upsertKPIWeights,
  getAllKPIWeights,
  calculateKPIScores,
  getEmployeeKPIScores,
  getDepartmentKPIScores,
  getMonthlyKPIReport,
  getKPITrend,
} = require("../controllers/kpi.controller");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============================================================
// KPI WEIGHT MANAGEMENT
// ============================================================

// Get all KPI weights (admin only)
router.get(
  "/weights",
  requireRole("admin", "super_admin", "hr_manager"),
  getAllKPIWeights,
);

// Get KPI weights for a department
router.get("/weights/:departmentId", getKPIWeights);

// Create or update KPI weights for a department
router.put(
  "/weights/:departmentId",
  requireRole("admin", "super_admin", "hr_manager", "dept_manager"),
  upsertKPIWeights,
);

// ============================================================
// KPI CALCULATION
// ============================================================

// Calculate KPI scores for a department
router.post(
  "/calculate/:departmentId",
  requireRole("admin", "super_admin", "hr_manager", "dept_manager"),
  calculateKPIScores,
);

// ============================================================
// KPI SCORE RETRIEVAL
// ============================================================

// Get employee KPI scores
router.get("/employee/:userId", getEmployeeKPIScores);

// Get employee KPI trend
router.get("/employee/:userId/trend", getKPITrend);

// Get department KPI scores
router.get("/department/:departmentId", getDepartmentKPIScores);

// Get monthly KPI report - THIS MUST COME AFTER SPECIFIC ROUTES
router.get("/report/monthly", getMonthlyKPIReport);

module.exports = router;
