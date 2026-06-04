const { Role } = require("../models/Role.model");
const { User } = require("../models/User.model");

// Get all roles
const getRoles = async (req, res) => {
  try {
    const roles = await Role.find({ isActive: true })
      .sort({ level: -1, createdAt: -1 });

    const rolesWithCount = await Promise.all(
      roles.map(async (role) => {
        const userCount = await User.countDocuments({ role: role.code.toLowerCase() });
        return {
          ...role.toObject(),
          userCount,
        };
      })
    );

    res.json({
      success: true,
      data: rolesWithCount,
      count: rolesWithCount.length,
    });
  } catch (error) {
    console.error("Get roles error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get single role
const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await Role.findById(id);
    
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    const userCount = await User.countDocuments({ role: role.code.toLowerCase() });

    res.json({
      success: true,
      data: { ...role.toObject(), userCount },
    });
  } catch (error) {
    console.error("Get role error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Create role
const createRole = async (req, res) => {
  try {
    const { name, code, description, level, permissions } = req.body;

    const existingRole = await Role.findOne({ 
      $or: [{ name }, { code: code.toUpperCase() }] 
    });
    
    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: "Role with this name or code already exists",
      });
    }

    const role = await Role.create({
      name,
      code: code.toUpperCase(),
      description,
      level: level || 50,
      permissions: permissions || [],
      isSystemRole: false,
      isPermanent: false,
      canEdit: true,
      canDelete: true,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: role,
    });
  } catch (error) {
    console.error("Create role error:", error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
};

// Update role
const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const existingRole = await Role.findById(id);
    if (!existingRole) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    // Check if role is permanent and cannot be edited
    if (existingRole.isPermanent && !existingRole.canEdit) {
      return res.status(403).json({
        success: false,
        message: "This is a permanent system role and cannot be modified",
      });
    }

    // Prevent editing system role name and code
    if (existingRole.isSystemRole) {
      delete updates.name;
      delete updates.code;
      delete updates.isSystemRole;
      delete updates.isPermanent;
    }

    const role = await Role.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: "Role updated successfully",
      data: role,
    });
  } catch (error) {
    console.error("Update role error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delete role
const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    
    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    // Prevent deleting permanent system roles
    if (role.isPermanent) {
      return res.status(403).json({
        success: false,
        message: "This is a permanent system role and cannot be deleted",
      });
    }

    // Prevent deleting system roles
    if (role.isSystemRole) {
      return res.status(403).json({
        success: false,
        message: "System roles cannot be deleted",
      });
    }

    // Check if any users have this role
    const userCount = await User.countDocuments({ role: role.code.toLowerCase() });
    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete role. ${userCount} users are currently assigned to this role. Please reassign them first.`,
      });
    }

    await Role.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Role deleted successfully",
    });
  } catch (error) {
    console.error("Delete role error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Seed default roles (PERMANENT)
const seedRoles = async (req, res) => {
  try {
    const existingCount = await Role.countDocuments();
    
    const defaultRoles = [
      { 
        name: "Super Admin", 
        code: "SUPER_ADMIN", 
        description: "Full system access with all permissions. This is a permanent system role.", 
        level: 100, 
        isSystemRole: true,
        isPermanent: true,
        canEdit: false,
        canDelete: false,
        permissions: ["*"]
      },
      { 
        name: "Admin", 
        code: "ADMIN", 
        description: "Administrative access with limited system control. This is a permanent system role.", 
        level: 90, 
        isSystemRole: true,
        isPermanent: true,
        canEdit: false,
        canDelete: false,
        permissions: ["manage_users", "manage_departments", "view_reports", "manage_settings"]
      },
      { 
        name: "HR Manager", 
        code: "HR_MANAGER", 
        description: "Human resources management access. This is a permanent system role.", 
        level: 80, 
        isSystemRole: true,
        isPermanent: true,
        canEdit: false,
        canDelete: false,
        permissions: ["manage_employees", "manage_attendance", "manage_leaves", "view_reports"]
      },
      { 
        name: "Department Manager", 
        code: "DEPT_MANAGER", 
        description: "Department-level management access. This is a permanent system role.", 
        level: 70, 
        isSystemRole: true,
        isPermanent: true,
        canEdit: false,
        canDelete: false,
        permissions: ["manage_team_tasks", "approve_tasks", "view_team_reports", "manage_attendance"]
      },
      { 
        name: "Project Manager", 
        code: "PROJECT_MANAGER", 
        description: "Project-specific management access. This is a permanent system role.", 
        level: 65, 
        isSystemRole: true,
        isPermanent: true,
        canEdit: false,
        canDelete: false,
        permissions: ["manage_project_tasks", "assign_members", "view_project_reports", "approve_submissions"]
      },
      { 
        name: "Line Manager", 
        code: "LINE_MANAGER", 
        description: "Team management access. This is a permanent system role.", 
        level: 60, 
        isSystemRole: true,
        isPermanent: true,
        canEdit: false,
        canDelete: false,
        permissions: ["assign_tasks", "review_submissions", "provide_feedback", "approve_time_off"]
      },
      { 
        name: "Employee", 
        code: "EMPLOYEE", 
        description: "Basic user access. This is a permanent system role.", 
        level: 10, 
        isSystemRole: true,
        isPermanent: true,
        canEdit: false,
        canDelete: false,
        permissions: ["view_own_tasks", "update_own_tasks", "submit_evidence", "request_leave"]
      },
    ];

    if (existingCount === 0) {
      await Role.insertMany(defaultRoles);
      return res.json({
        success: true,
        message: `${defaultRoles.length} permanent system roles seeded successfully`,
        data: defaultRoles,
      });
    }

    // Update existing roles to be permanent if they are system roles
    for (const defaultRole of defaultRoles) {
      await Role.findOneAndUpdate(
        { code: defaultRole.code },
        { 
          $setOnInsert: defaultRole,
          $set: {
            isPermanent: true,
            canEdit: false,
            canDelete: false,
          }
        },
        { upsert: true, new: true }
      );
    }

    res.json({
      success: true,
      message: "System roles verified and set as permanent",
    });
  } catch (error) {
    console.error("Seed roles error:", error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
};

// Get permanent roles info
const getPermanentRoles = async (req, res) => {
  try {
    const permanentRoles = await Role.find({ isPermanent: true, isActive: true })
      .select('name code description level isSystemRole')
      .sort({ level: -1 });

    res.json({
      success: true,
      data: permanentRoles,
      count: permanentRoles.length,
      message: "These are permanent system roles that cannot be deleted or modified",
    });
  } catch (error) {
    console.error("Get permanent roles error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  seedRoles,
  getPermanentRoles,
};