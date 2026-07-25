// routes/kpi.routes.js - Updated

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

router.get(
  "/weights",
  requireRole("admin", "super_admin", "hr_manager"),
  getAllKPIWeights,
);

router.get("/weights/:departmentId", getKPIWeights);

router.put(
  "/weights/:departmentId",
  requireRole("admin", "super_admin", "hr_manager", "dept_manager"),
  upsertKPIWeights,
);

// ============================================================
// KPI CALCULATION
// ============================================================

router.post(
  "/calculate/:departmentId",
  requireRole("admin", "super_admin", "hr_manager", "dept_manager"),
  calculateKPIScores,
);

// ============================================================
// KPI SCORE RETRIEVAL
// ============================================================

// IMPORTANT: Specific routes must come BEFORE dynamic routes
// Get employee KPI scores
router.get("/employee/:userId", getEmployeeKPIScores);

// Get employee KPI trend
router.get("/employee/:userId/trend", getKPITrend);

// Get department KPI scores
router.get("/department/:departmentId", getDepartmentKPIScores);

// ============================================================
// MONTHLY REPORT - This must be AFTER specific routes
// But BEFORE the catch-all route
// ============================================================

// Get monthly KPI report with optional month/year params
// If no params provided, uses current month
router.get("/report/monthly", getMonthlyKPIReport);

// Get KPI weights - moved here to avoid conflict
// This is a catch-all route for anything not matched above
// But we already have specific routes above

module.exports = router;
