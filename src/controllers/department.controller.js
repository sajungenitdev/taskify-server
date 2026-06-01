const { Department } = require("../models/Department.model");
const { User } = require("../models/User.model");

// Get all departments
const getAllDepartments = async (req, res) => {
  try {
    const departments = await Department.find({ isActive: true })
      .populate("headOfDepartment", "fullName email employeeId")
      .sort({ name: 1 });

    res.json({ success: true, data: departments, count: departments.length });
  } catch (error) {
    console.error("Get departments error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get single department by ID
const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const department = await Department.findById(id)
      .populate("headOfDepartment", "fullName email employeeId")
      .populate("parentDepartment", "name code");

    if (!department) {
      return res
        .status(404)
        .json({ success: false, message: "Department not found" });
    }

    res.json({ success: true, data: department });
  } catch (error) {
    console.error("Get department error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Create department (Super Admin only)
const createDepartment = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      headOfDepartment,
      parentDepartment,
      settings,
    } = req.body;

    const existingDept = await Department.findOne({
      $or: [{ name }, { code }],
    });
    if (existingDept) {
      return res
        .status(400)
        .json({ success: false, message: "Department already exists" });
    }

    const department = await Department.create({
      name,
      code: code.toUpperCase(),
      description,
      headOfDepartment,
      parentDepartment,
      settings,
      employeeCount: 0,
    });

    // If head of department is set, update user role
    if (headOfDepartment) {
      await User.findByIdAndUpdate(headOfDepartment, {
        role: "dept_manager",
        departmentId: department._id,
      });
    }

    res.status(201).json({
      success: true,
      message: "Department created successfully",
      data: department,
    });
  } catch (error) {
    console.error("Create department error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update department (Super Admin only)
const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const department = await Department.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true },
    );

    if (!department) {
      return res
        .status(404)
        .json({ success: false, message: "Department not found" });
    }

    res.json({
      success: true,
      message: "Department updated successfully",
      data: department,
    });
  } catch (error) {
    console.error("Update department error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delete department (Super Admin only)
const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if department has employees
    const employeeCount = await User.countDocuments({
      departmentId: id,
      isActive: true,
    });
    if (employeeCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete department with ${employeeCount} active employees. Reassign or deactivate them first.`,
      });
    }

    const department = await Department.findByIdAndDelete(id);
    if (!department) {
      return res
        .status(404)
        .json({ success: false, message: "Department not found" });
    }

    res.json({
      success: true,
      message: "Department deleted successfully",
    });
  } catch (error) {
    console.error("Delete department error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get department employees
const getDepartmentEmployees = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, isActive } = req.query;

    const query = { departmentId: id };
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === "true";

    const employees = await User.find(query)
      .select("-password")
      .populate("managerId", "fullName email employeeId")
      .sort({ fullName: 1 });

    res.json({
      success: true,
      data: employees,
      count: employees.length,
    });
  } catch (error) {
    console.error("Get department employees error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update department employee count
const updateDepartmentEmployeeCount = async (req, res) => {
  try {
    const { id } = req.params;
    const count = await User.countDocuments({
      departmentId: id,
      isActive: true,
    });
    await Department.findByIdAndUpdate(id, { employeeCount: count });

    res.json({
      success: true,
      message: "Employee count updated",
      data: { employeeCount: count },
    });
  } catch (error) {
    console.error("Update count error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentEmployees,
  updateDepartmentEmployeeCount,
};
