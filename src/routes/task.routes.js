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
  bulkCreateTasks,
  getTasksByProject,
  importTasksFromFile,
  reorderTasks,
  getProjectTasksSummary,
  getTaskStatistics,
} = require("../controllers/task.controller");
const { authenticate, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============= EMPLOYEE ROUTES =============
router.get("/my-tasks", getMyTasks);
router.get("/my-statistics", getTaskStatistics);

// ============= TASK OPERATIONS =============
router.get("/", getTasks);
router.get("/:id", getTaskById);

// ============= PROJECT-SPECIFIC TASK ROUTES =============
// Get tasks by project (with pagination and filtering)
router.get("/project/:projectId", getTasksByProject);

// Get project tasks summary and analytics
router.get("/project/:projectId/summary", getProjectTasksSummary);

// ============= BULK OPERATIONS (Managers only) =============
// Bulk create multiple tasks for a project
router.post(
  "/project/:projectId/bulk",
  requireRole("admin", "dept_manager", "project_manager", "line_manager"),
  [
    body("tasks").isArray().withMessage("Tasks must be an array"),
    body("tasks.*.title").notEmpty().withMessage("Each task must have a title"),
    body("tasks.*.description")
      .notEmpty()
      .withMessage("Each task must have a description"),
    body("tasks.*.assignedTo")
      .notEmpty()
      .withMessage("Each task must have an assigned user"),
    body("tasks.*.deadline")
      .isISO8601()
      .withMessage("Each task must have a valid deadline"),
  ],
  bulkCreateTasks,
);

// Import tasks from JSON/Array
router.post(
  "/project/:projectId/import",
  requireRole("admin", "dept_manager", "project_manager"),
  [body("tasks").isArray().withMessage("Tasks must be an array")],
  importTasksFromFile,
);

// Reorder tasks within a project
router.put(
  "/project/:projectId/reorder",
  requireRole("admin", "dept_manager", "project_manager"),
  [
    body("taskOrders").isArray().withMessage("taskOrders must be an array"),
    body("taskOrders.*.taskId")
      .notEmpty()
      .withMessage("Each item must have a taskId"),
    body("taskOrders.*.order")
      .isNumeric()
      .withMessage("Each item must have an order number"),
  ],
  reorderTasks,
);

// ============= SINGLE TASK OPERATIONS =============
// Create single task (Managers only)
router.post(
  "/",
  requireRole("admin", "dept_manager", "project_manager", "line_manager"),
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("assignedTo").notEmpty().withMessage("AssignedTo is required"),
    body("projectId").notEmpty().withMessage("ProjectId is required"),
    body("deadline").isISO8601().withMessage("Valid deadline is required"),
  ],
  createTask,
);

// Update task (with role-based restrictions)
router.put("/:id", updateTask);

// Update task status
router.patch(
  "/:id/status",
  [
    body("status")
      .isIn([
        "pending",
        "in_progress",
        "submitted",
        "completed",
        "overdue",
        "rejected",
      ])
      .withMessage("Invalid status value"),
  ],
  updateTaskStatus,
);

// ============= EXTENSION REQUESTS =============
// Request deadline extension
router.post(
  "/:id/request-extension",
  [
    body("requestedDate")
      .isISO8601()
      .withMessage("Valid requested date is required"),
    body("reason").notEmpty().withMessage("Reason is required"),
  ],
  requestExtension,
);

// Approve extension (Managers only)
router.post(
  "/:id/approve-extension/:extensionId",
  requireRole("admin", "dept_manager", "line_manager"),
  [
    body("newDeadline")
      .isISO8601()
      .withMessage("Valid new deadline is required"),
  ],
  approveExtension,
);

// ============= DELETE TASK =============
// Delete task (Admin/Department Managers only)
router.delete("/:id", requireRole("admin", "dept_manager"), deleteTask);

module.exports = router;
