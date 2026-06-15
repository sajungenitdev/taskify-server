const express = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const {
  getUserNotifications,
  getNotificationStats,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  deleteNotification,
  deleteAllRead,
  bulkAction,
  getUnreadCount,
} = require("../controllers/notification.controller");

const router = express.Router();

// All notification routes require authentication
router.use(authenticate);

// Get notifications and stats
router.get("/", getUserNotifications);
router.get("/stats", getNotificationStats);
router.get("/unread-count", getUnreadCount);

// Bulk actions
router.patch("/read-all", markAllAsRead);
router.delete("/read", deleteAllRead);
router.post("/bulk", bulkAction);

// Individual notification actions
router.patch("/:id/read", markAsRead);
router.patch("/:id/unread", markAsUnread);
router.delete("/:id", deleteNotification);

module.exports = router;
