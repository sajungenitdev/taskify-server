const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const {
  getAllTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  addMembers,
  removeMember,
  getTeamMembers,
  getUserTeams,
  getTeamsByDepartment,
  getTeamStats,
} = require("../controllers/team.controller");

// All routes require authentication
router.use(authenticate);

// Team statistics (must come before /:id routes)
router.get(
  "/stats",
  requireRole("admin", "super_admin", "hr_manager"),
  getTeamStats,
);

// Get user's teams
router.get(
  "/user/:userId",
  requireRole("admin", "super_admin", "hr_manager", "employee"),
  getUserTeams,
);

// Get teams by department
router.get(
  "/department/:department",
  requireRole("admin", "super_admin", "hr_manager"),
  getTeamsByDepartment,
);

// Get all teams
router.get(
  "/",
  requireRole("admin", "super_admin", "hr_manager", "employee"),
  getAllTeams,
);

// Create team
router.post("/", requireRole("admin", "super_admin", "hr_manager"), createTeam);

// Get team members
router.get(
  "/:id/members",
  requireRole("admin", "super_admin", "hr_manager", "employee"),
  getTeamMembers,
);

// Add members to team
router.post(
  "/:id/members",
  requireRole("admin", "super_admin", "hr_manager"),
  addMembers,
);

// Remove member from team
router.delete(
  "/:id/members/:memberId",
  requireRole("admin", "super_admin", "hr_manager"),
  removeMember,
);

// Get single team
router.get(
  "/:id",
  requireRole("admin", "super_admin", "hr_manager", "employee"),
  getTeamById,
);

// Update team
router.put(
  "/:id",
  requireRole("admin", "super_admin", "hr_manager"),
  updateTeam,
);

// Delete team
router.delete("/:id", requireRole("super_admin"), deleteTeam);

module.exports = router;
