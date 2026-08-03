// routes/pricingPlan.routes.js
const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const pricingPlanController = require("../controllers/pricingPlan.controller");

// ============================================================
// PUBLIC ROUTES (no authentication required)
// ============================================================

/**
 * @route   GET /api/v1/pricing-plans
 * @desc    Get all active pricing plans
 * @access  Public
 */
router.get("/", pricingPlanController.getPlans);

/**
 * @route   GET /api/v1/pricing-plans/all (Admin only)
 * @desc    Get all pricing plans including inactive
 * @access  Private (Admin only)
 */
router.get(
    "/all",
    authenticate,
    requireRole("super_admin", "admin"),
    pricingPlanController.getAllPlansAdmin
);

/**
 * @route   GET /api/v1/pricing-plans/:slug
 * @desc    Get single plan by slug
 * @access  Public
 */
router.get("/:slug", pricingPlanController.getPlanBySlug);

// ============================================================
// ADMIN ROUTES (authentication required)
// ============================================================

router.use(authenticate);
router.use(requireRole("super_admin", "admin"));

/**
 * @route   POST /api/v1/pricing-plans
 * @desc    Create a new pricing plan
 * @access  Private (Admin only)
 */
router.post("/", pricingPlanController.createPlan);

/**
 * @route   PUT /api/v1/pricing-plans/:id
 * @desc    Update a pricing plan
 * @access  Private (Admin only)
 */
router.put("/:id", pricingPlanController.updatePlan);

/**
 * @route   DELETE /api/v1/pricing-plans/:id
 * @desc    Delete (soft) a pricing plan
 * @access  Private (Admin only)
 */
router.delete("/:id", pricingPlanController.deletePlan);

/**
 * @route   PATCH /api/v1/pricing-plans/:id/toggle
 * @desc    Toggle plan active status
 * @access  Private (Admin only)
 */
router.patch("/:id/toggle", pricingPlanController.togglePlanStatus);

/**
 * @route   POST /api/v1/pricing-plans/order
 * @desc    Set plan display order
 * @access  Private (Admin only)
 */
router.post("/order", pricingPlanController.setPlanOrder);

module.exports = router;