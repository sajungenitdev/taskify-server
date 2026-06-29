// routes/attendance.routes.js

const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const {
  getTodayAttendance,
  startTimer,
  pauseTimer,
  resumeTimer,
  checkOut,
  getTimerStatus,
  getEmployeeAttendance,
  getEmployeeAttendanceStats,
  getAllAttendance,
  getAttendanceDashboardStats,
  updateAttendanceStatus,
  exportAttendance,
} = require("../controllers/attendance.controller");

const router = express.Router();

// ============================================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================================
router.use(authenticate);

// ============================================================================
// EMPLOYEE TIMER ROUTES
// ============================================================================
// Get today's attendance
router.get("/today", getTodayAttendance);

// Timer operations
router.post("/start", startTimer);
router.post("/pause", pauseTimer);
router.post("/resume", resumeTimer);
router.post("/checkout", checkOut);

// Get timer status
router.get("/timer-status", getTimerStatus);

// ============================================================================
// EMPLOYEE HISTORY ROUTES
// ============================================================================
// Get attendance history
router.get("/history", getEmployeeAttendance);
router.get("/stats", getEmployeeAttendanceStats);

// ============================================================================
// ADMIN ROUTES
// ============================================================================
// Get all attendance records (Admin/HR only)
router.get(
  "/all",
  requireRole("admin", "super_admin", "hr_manager"),
  getAllAttendance,
);

// Get dashboard stats (Admin/HR only)
router.get(
  "/dashboard-stats",
  requireRole("admin", "super_admin", "hr_manager"),
  getAttendanceDashboardStats,
);

// Update attendance status (Admin/HR only)
router.patch(
  "/:id/status",
  requireRole("admin", "super_admin", "hr_manager"),
  updateAttendanceStatus,
);

// Export attendance (Admin/HR only)
router.get(
  "/export",
  requireRole("admin", "super_admin", "hr_manager"),
  exportAttendance,
);

module.exports = router;
