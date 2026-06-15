const express = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const {
  getPerformanceMetrics,
  getTaskStats,
  getProductivityData,
  getCategoryStats,
  getMonthlyStats,
  getAchievements,
  getRatings,
} = require("../controllers/performance.controller");

const router = express.Router();

// All performance routes require authentication
router.use(authenticate);

// Performance metrics
router.get("/metrics", getPerformanceMetrics);
router.get("/task-stats", getTaskStats);
router.get("/productivity", getProductivityData);
router.get("/category-stats", getCategoryStats);
router.get("/monthly-stats", getMonthlyStats);
router.get("/achievements", getAchievements);
router.get("/ratings", getRatings);

module.exports = router;