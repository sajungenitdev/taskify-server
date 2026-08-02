// routes/kpi.routes.js - Complete Updated Version
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
  getEmployeeKPI,
  getDepartmentKPI,
  getKPILeaderboard,
  getKPIStatistics,
} = require("../controllers/kpi.controller");

const router = express.Router();

// ============================================================
// All routes require authentication
// ============================================================
router.use(authenticate);

// ============================================================
// IMPORTANT: Specific routes MUST come BEFORE dynamic routes
// ============================================================

// ============================================================
// KPI WEIGHT MANAGEMENT
// ============================================================

// GET all KPI weights (no params) - MUST come FIRST
router.get(
  "/weights",
  requireRole("admin", "super_admin", "hr_manager"),
  getAllKPIWeights
);

// GET KPI weights by department
router.get(
  "/weights/:departmentId",
  requireRole("admin", "super_admin", "hr_manager", "dept_manager", "project_manager"),
  getKPIWeights
);

// PUT KPI weights by department - Only admins and dept managers can modify
router.put(
  "/weights/:departmentId",
  requireRole("admin", "super_admin", "hr_manager", "dept_manager"),
  upsertKPIWeights
);

// ============================================================
// KPI CALCULATION - Admin only
// ============================================================

router.post(
  "/calculate/:departmentId",
  requireRole("admin", "super_admin", "hr_manager", "dept_manager"),
  calculateKPIScores
);

// ============================================================
// KPI SCORE RETRIEVAL
// ============================================================

// GET employee KPI trend - specific route FIRST
router.get(
  "/employee/:userId/trend",
  requireRole("admin", "super_admin", "hr_manager", "dept_manager", "project_manager"),
  getKPITrend
);

// GET employee KPI scores
router.get(
  "/employee/:userId",
  requireRole("admin", "super_admin", "hr_manager", "dept_manager", "project_manager"),
  getEmployeeKPIScores
);

// GET department KPI scores
router.get(
  "/department/:departmentId",
  requireRole("admin", "super_admin", "hr_manager", "dept_manager", "project_manager"),
  getDepartmentKPIScores
);

// ============================================================
// KPI LEADERBOARD
// ============================================================

// GET KPI leaderboard for a department
router.get(
  "/leaderboard/:departmentId",
  requireRole("admin", "super_admin", "hr_manager", "dept_manager", "project_manager"),
  getKPILeaderboard
);

// GET KPI leaderboard for all departments (admin only)
router.get(
  "/leaderboard",
  requireRole("admin", "super_admin", "hr_manager"),
  getKPILeaderboard
);

// ============================================================
// KPI STATISTICS
// ============================================================

// GET KPI statistics for a department
router.get(
  "/statistics/:departmentId",
  requireRole("admin", "super_admin", "hr_manager", "dept_manager", "project_manager"),
  getKPIStatistics
);

// GET KPI statistics for all departments (admin only)
router.get(
  "/statistics",
  requireRole("admin", "super_admin", "hr_manager"),
  getKPIStatistics
);

// ============================================================
// MONTHLY REPORT - Must be after specific routes
// ============================================================

// GET monthly KPI report with optional month/year params
// If no params provided, uses current month
router.get(
  "/report/monthly",
  requireRole("admin", "super_admin", "hr_manager", "dept_manager", "project_manager"),
  getMonthlyKPIReport
);

// ============================================================
// KPI DASHBOARD - Catch-all route (must be LAST)
// ============================================================

// GET KPI dashboard data
router.get(
  "/dashboard",
  requireRole("admin", "super_admin", "hr_manager", "dept_manager", "project_manager"),
  getEmployeeKPI
);

// GET employee KPI overview (alias for dashboard)
router.get(
  "/my-kpi",
  requireRole("admin", "super_admin", "hr_manager", "dept_manager", "project_manager", "employee"),
  getEmployeeKPI
);

module.exports = router;