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
} = require("../controllers/project.controller");

const router = express.Router();

// All routes require authentication (no role restrictions)
router.use(authenticate);

// Project routes - allow all authenticated users
router.get("/", getProjects);
router.get("/templates", getProjectTemplates);
router.get("/resources", getProjectResources);
router.get("/:id", getProjectById);
router.post("/", createProject);
router.put("/:id", updateProject);
router.patch("/:id/progress", updateProjectProgress);
router.delete("/:id", deleteProject);

module.exports = router;
