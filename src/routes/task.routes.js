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
// Add these imports at the top of your routes file
const {
  getTaskComments,
  addComment,
  updateComment,
  deleteComment,
  toggleCommentLike,
} = require("../controllers/comment.controller");

const {
  uploadAttachments,
  getTaskAttachments,
  downloadAttachment,
  deleteAttachment,
} = require("../controllers/attachment.controller");

const {
  getTaskReviews,
  addReview,
  updateReview,
  deleteReview,
  respondToReview,
} = require("../controllers/review.controller");

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
router.get("/project/:projectId", getTasksByProject);
router.get("/project/:projectId/summary", getProjectTasksSummary);

// ============= BULK OPERATIONS =============
router.post(
  "/project/:projectId/bulk",
  // requireRole("admin", "dept_manager", "project_manager", "line_manager", "employee"),
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

router.post(
  "/project/:projectId/import",
  authenticate,
  [body("tasks").isArray().withMessage("Tasks must be an array")],
  importTasksFromFile,
);

router.put(
  "/project/:projectId/reorder",
  authenticate,
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
// Allow any authenticated user to create a task (no role restriction)
router.post(
  "/",
  authenticate, // Only authentication required, no role check
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
    // Add optional validation for rejectionReason
    body("rejectionReason")
      .optional()
      .isString()
      .withMessage("Rejection reason must be a string"),
    body("approvalNote")
      .optional()
      .isString()
      .withMessage("Approval note must be a string"),
  ],
  updateTaskStatus,
);

// ============= EXTENSION REQUESTS =============
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

// ============= COMMENT ROUTES =============
router.get("/:id/comments", getTaskComments);
router.post("/:id/comments", addComment);
router.put("/:id/comments/:commentId", updateComment);
router.delete("/:id/comments/:commentId", deleteComment);
router.post("/:id/comments/:commentId/like", toggleCommentLike);

// ============= ATTACHMENT ROUTES =============
router.get("/:id/attachments", getTaskAttachments);
router.post("/:id/attachments", uploadAttachments);
router.get("/:id/attachments/:attachmentId/download", downloadAttachment);
router.delete("/:id/attachments/:attachmentId", deleteAttachment);

// ============= REVIEW ROUTES =============
router.get("/:id/reviews", getTaskReviews);
router.post("/:id/reviews", addReview);
router.put("/:id/reviews/:reviewId", updateReview);
router.delete("/:id/reviews/:reviewId", deleteReview);
router.post("/:id/reviews/:reviewId/respond", respondToReview);

// ============= DELETE TASK =============
router.delete("/:id", requireRole("admin", "dept_manager"), deleteTask);

module.exports = router;
