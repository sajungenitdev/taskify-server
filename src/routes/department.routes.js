const express = require("express");
const { body } = require("express-validator");
const {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentEmployees,
  updateDepartmentEmployeeCount,
} = require("../controllers/department.controller");
const {
  authenticate,
  requireRole,
  requireMinRole,
} = require("../middleware/auth.middleware");

const router = express.Router();

// Validation rules
const createDepartmentValidation = [
  body("name").notEmpty().trim(),
  body("code").notEmpty().isLength({ min: 2, max: 10 }),
  body("description").optional(),
  body("headOfDepartment").optional().isMongoId(),
];

const updateDepartmentValidation = [
  body("name").optional().trim(),
  body("code").optional().isLength({ min: 2, max: 10 }),
  body("description").optional(),
  body("headOfDepartment").optional().isMongoId(),
  body("isActive").optional().isBoolean(),
];

// All routes require authentication
router.use(authenticate);

// Routes accessible by authenticated users
router.get("/", getAllDepartments);
router.get("/:id", getDepartmentById);
router.get(
  "/:id/employees",
  requireMinRole("dept_manager"),
  getDepartmentEmployees,
);

// Routes accessible only by Super Admin
router.post(
  "/",
  requireRole("super_admin"),
  createDepartmentValidation,
  createDepartment,
);
router.put(
  "/:id",
  requireRole("super_admin"),
  updateDepartmentValidation,
  updateDepartment,
);
router.delete("/:id", requireRole("super_admin"), deleteDepartment);
router.put(
  "/:id/update-count",
  requireRole("super_admin"),
  updateDepartmentEmployeeCount,
);

module.exports = router;
