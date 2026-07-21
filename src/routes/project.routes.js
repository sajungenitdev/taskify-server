// routes/project.routes.js
const express = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  updateProjectProgress,
  getProjectTemplates,
  getProjectResources,
  getProjectBurndown,
  getProjectTaskStats,
  getProjectActivities,
  getTeamPerformance,
  archiveProject,
  unarchiveProject,
} = require("../controllers/project.controller");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Project routes
router.get("/", getProjects);
router.get("/templates", getProjectTemplates);
router.get("/resources", getProjectResources);
router.get("/:id", getProjectById);

// Create and update
router.post("/", createProject);
router.put("/:id", updateProject);

// Progress update
router.patch("/:id/progress", updateProjectProgress);

// Archive/Unarchive
router.patch("/:id/archive", archiveProject);
router.patch("/:id/unarchive", unarchiveProject);

// Dashboard routes
router.get("/:id/burndown", getProjectBurndown);
router.get("/:id/task-stats", getProjectTaskStats);
router.get("/:id/activities", getProjectActivities);
router.get("/:id/team-performance", getTeamPerformance);

// Delete (soft delete)
router.delete("/:id", deleteProject);

module.exports = router;
