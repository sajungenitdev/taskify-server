// routes/workload.routes.js
const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const {
  getTeamWorkload,
  getIndividualWorkload,
} = require("../controllers/workload.controller");

// All routes require authentication
router.use(authenticate);

// Get team workload capacity dashboard
router.get("/capacity", getTeamWorkload);

// Get individual workload details
router.get("/individual/:userId", getIndividualWorkload);

module.exports = router;