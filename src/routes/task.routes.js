const express = require("express");
const { body } = require("express-validator");
const {
  getTasks,
  getMyTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  requestExtension,
  approveExtension,
  deleteTask,
} = require("../controllers/task.controller");
const { authenticate, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Employee routes
router.get("/my-tasks", getMyTasks);

// Task operations
router.get("/", getTasks);
router.get("/:id", getTaskById);

// Create task (Managers only)
router.post(
  "/",
  requireRole("admin", "dept_manager", "project_manager", "line_manager"),
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("assignedTo").notEmpty().withMessage("AssignedTo is required"),
    body("deadline").isISO8601().withMessage("Valid deadline is required"),
  ],
  createTask,
);

// Update task
router.put("/:id", updateTask);
router.patch("/:id/status", updateTaskStatus);

// Extension requests
router.post("/:id/request-extension", requestExtension);
router.post(
  "/:id/approve-extension/:extensionId",
  requireRole("admin", "dept_manager", "line_manager"),
  approveExtension,
);

// Delete task (Admin/Managers only)
router.delete("/:id", requireRole("admin", "dept_manager"), deleteTask);

module.exports = router;
