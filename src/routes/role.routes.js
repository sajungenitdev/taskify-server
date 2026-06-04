const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  seedRoles,
  getPermanentRoles,
} = require("../controllers/role.controller");

const router = express.Router();

router.use(authenticate);

// Public role routes (authenticated users can view)
router.get("/", getRoles);
router.get("/permanent", getPermanentRoles);
router.get("/:id", getRoleById);

// Admin only routes
router.post("/", requireRole("super_admin"), createRole);
router.put("/:id", requireRole("super_admin"), updateRole);
router.delete("/:id", requireRole("super_admin"), deleteRole);
router.post("/seed", requireRole("super_admin"), seedRoles);

module.exports = router;
