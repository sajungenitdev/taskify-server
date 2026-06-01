const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, userRoles } = require("../models/User.model");

// ============ REGISTER USER ============
const register = async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      employeeId,
      role,
      departmentId,
      managerId,
      phoneNumber,
      dailyHoursTarget,
    } = req.body;

    const existingUser = await User.findOne({
      $or: [{ email }, { employeeId }],
    });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    if (departmentId) {
      const Department = require("../models/Department.model").Department;
      const department = await Department.findById(departmentId);
      if (!department) {
        return res
          .status(400)
          .json({ success: false, message: "Department not found" });
      }
    }

    if (managerId) {
      const manager = await User.findById(managerId);
      if (!manager) {
        return res
          .status(400)
          .json({ success: false, message: "Manager not found" });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullName,
      email,
      password: hashedPassword,
      employeeId,
      role: role || "employee",
      departmentId,
      managerId,
      phoneNumber,
      dailyHoursTarget: dailyHoursTarget || 8,
      firstLogin: true,
      isActive: true,
    });

    if (departmentId) {
      const Department = require("../models/Department.model").Department;
      await Department.findByIdAndUpdate(departmentId, {
        $inc: { employeeCount: 1 },
      });
    }

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: userResponse,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ GET DEMO USERS ============
const getDemoUsers = async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select("fullName email role employeeId")
      .limit(6);

    const demoUsers = users.map((user) => ({
      role: user.role.replace("_", " ").toUpperCase(),
      email: user.email,
      name: user.fullName,
      badge:
        user.role === "super_admin"
          ? "Full Access"
          : user.role === "admin"
            ? "Management"
            : user.role === "hr_manager"
              ? "HR Panel"
              : user.role === "dept_manager"
                ? "Team Lead"
                : user.role === "employee"
                  ? "Staff Access"
                  : "Access",
    }));

    res.json({
      success: true,
      data: demoUsers,
    });
  } catch (error) {
    console.error("Get demo users error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ LOGIN ============
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || "7d" },
    );

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: userResponse,
        accessToken: token,
        firstLogin: user.firstLogin,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ REFRESH TOKEN ============
const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res
        .status(401)
        .json({ success: false, message: "Refresh token required" });
    }

    // Verify refresh token logic here
    // For now, return a new access token
    res.json({
      success: true,
      message: "Token refreshed",
      data: { accessToken: "new-token" },
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ LOGOUT ============
const logout = async (req, res) => {
  try {
    res.clearCookie("refreshToken");
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ FORGOT PASSWORD ============
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal that user doesn't exist for security
      return res.json({
        success: true,
        message: "Password reset link sent to email",
      });
    }

    // Generate reset token and send email (implement email service)
    // For now, just return success
    res.json({ success: true, message: "Password reset link sent to email" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ RESET PASSWORD ============
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Verify token and reset password logic here
    // For now, just return success
    res.json({ success: true, message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ CHANGE PASSWORD ============
const changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(userId).select("+password");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ success: false, message: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ COMPLETE ONBOARDING ============
const completeOnboarding = async (req, res) => {
  try {
    const userId = req.user._id;
    const { fullName, phoneNumber, dailyHoursTarget, notificationPreferences } =
      req.body;

    await User.findByIdAndUpdate(userId, {
      fullName,
      phoneNumber,
      dailyHoursTarget,
      notificationPreferences,
      firstLogin: false,
    });

    res.json({ success: true, message: "Onboarding completed successfully" });
  } catch (error) {
    console.error("Onboarding error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ GET ALL USERS (ADMIN ONLY) ============
const getAllUsers = async (req, res) => {
  try {
    const { role, departmentId, isActive } = req.query;
    const query = {};
    if (role) query.role = role;
    if (departmentId) query.departmentId = departmentId;
    if (isActive) query.isActive = isActive === "true";

    const users = await User.find(query)
      .select("-password")
      .populate("departmentId", "name code")
      .populate("managerId", "fullName email");

    res.json({ success: true, data: users, count: users.length });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ GET CURRENT USER ============
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("departmentId", "name code")
      .populate("managerId", "fullName email");

    res.json({ success: true, data: user });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ UPDATE USER (ADMIN ONLY) ============
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phoneNumber, role, departmentId, managerId, isActive } =
      req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { fullName, phoneNumber, role, departmentId, managerId, isActive },
      { new: true },
    ).select("-password");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "User updated", data: user });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ DELETE USER (SUPER ADMIN ONLY) ============
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.json({ success: true, message: "User deleted" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ CHANGE USER ROLE (SUPER ADMIN ONLY) ============
const changeUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true },
    ).select("-password");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "Role updated", data: user });
  } catch (error) {
    console.error("Change role error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ UPDATE MY PROFILE (SELF) ============
const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const updates = req.body;

    const allowedUpdates = [
      "fullName",
      "phoneNumber",
      "dailyHoursTarget",
      "bio",
      "position",
      "location",
      "website",
      "socialLinks",
      "address",
      "emergencyContact",
      "skills",
      "languages",
      "achievements",
      "notificationPreferences",
    ];

    const updateData = {};
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        updateData[key] = updates[key];
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true },
    )
      .select("-password")
      .populate("departmentId", "name code")
      .populate("managerId", "fullName email");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ GET USER PROFILE BY ID (ADMIN) ============
const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id)
      .select("-password")
      .populate("departmentId", "name code")
      .populate("managerId", "fullName email");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error("Get user profile error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ UPLOAD PROFILE PHOTO ============
const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const photoUrl = `/uploads/profiles/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profilePhoto: photoUrl },
      { new: true },
    ).select("-password");

    res.json({
      success: true,
      message: "Profile photo updated",
      data: { profilePhoto: user.profilePhoto },
    });
  } catch (error) {
    console.error("Upload photo error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ EXPORT USERS ============
const exportUsers = async (req, res) => {
  try {
    const {
      type = "users",
      format = "csv",
      role,
      department,
      status,
    } = req.query;

    console.log("Export request:", { type, format, role, department, status });

    let query = {};
    if (role && role !== "") query.role = role;
    if (department && department !== "") query.departmentId = department;
    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;

    let data = [];
    let filename = "";

    if (type === "users") {
      const users = await User.find(query)
        .select("-password")
        .populate("departmentId", "name code");

      console.log(`Found ${users.length} users to export`);

      data = users.map((user) => ({
        "Full Name": user.fullName,
        Email: user.email,
        "Employee ID": user.employeeId,
        "Phone Number": user.phoneNumber || "",
        Role: user.role.replace(/_/g, " "),
        Department: user.departmentId ? user.departmentId.name : "Not Assigned",
        Status: user.isActive ? "Active" : "Inactive",
        "Last Login": user.lastLogin
          ? new Date(user.lastLogin).toLocaleDateString()
          : "Never",
        "Member Since": new Date(user.createdAt).toLocaleDateString(),
      }));
      filename = `users_export_${new Date().toISOString().split("T")[0]}`;
    } else if (type === "departments") {
      const Department = require("../models/Department.model").Department;
      const departments = await Department.find({}).populate(
        "headOfDepartment",
        "fullName email",
      );

      console.log(`Found ${departments.length} departments to export`);

      data = departments.map((dept) => ({
        "Department Name": dept.name,
        Code: dept.code,
        Description: dept.description || "",
        "Head of Department": dept.headOfDepartment
          ? dept.headOfDepartment.fullName
          : "Not Assigned",
        "Employee Count": dept.employeeCount,
        Status: dept.isActive ? "Active" : "Inactive",
        Created: new Date(dept.createdAt).toLocaleDateString(),
      }));
      filename = `departments_export_${new Date().toISOString().split("T")[0]}`;
    }

    if (data.length === 0) {
      // Return empty data message
      if (format === "csv") {
        return res.status(200).send("No data found for export");
      } else {
        return res.json({ success: true, data: [], message: "No data found" });
      }
    }

    if (format === "csv") {
      const headers = Object.keys(data[0]);
      const csvRows = [];

      // Add headers
      csvRows.push(headers.join(","));

      // Add rows
      for (const row of data) {
        const values = headers.map((header) => {
          const value = row[header] || "";
          // Escape quotes and wrap in quotes if contains comma or quote
          const escaped = String(value).replace(/"/g, '""');
          return `"${escaped}"`;
        });
        csvRows.push(values.join(","));
      }

      const csvContent = csvRows.join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${filename}.csv`,
      );
      res.setHeader("Content-Length", Buffer.byteLength(csvContent));
      return res.send(csvContent);
    } else {
      // JSON format
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${filename}.json`,
      );
      return res.json({ success: true, data, count: data.length });
    }
  } catch (error) {
    console.error("Export error:", error);
    res
      .status(500)
      .json({ success: false, message: "Export failed: " + error.message });
  }
};
// ============ BULK IMPORT USERS ============
const bulkImportUsers = async (req, res) => {
  try {
    const { users } = req.body;
    const bcrypt = require("bcryptjs");

    console.log(`Received ${users?.length || 0} users for import`);

    if (!users || users.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No users data provided" });
    }

    let successCount = 0;
    let failedCount = 0;
    const errors = [];

    for (const userData of users) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({
          $or: [{ email: userData.email }, { employeeId: userData.employeeId }],
        });

        if (existingUser) {
          errors.push(`${userData.email} - User already exists`);
          failedCount++;
          continue;
        }

        // Find department by code
        let departmentId = null;
        if (userData.departmentCode) {
          const Department = require("../models/Department.model").Department;
          const department = await Department.findOne({
            code: userData.departmentCode.toUpperCase(),
          });
          if (department) {
            departmentId = department._id;
          } else {
            errors.push(
              `${userData.email} - Department not found: ${userData.departmentCode}`,
            );
          }
        }

        const hashedPassword = await bcrypt.hash(userData.password, 10);

        await User.create({
          fullName: userData.fullName,
          email: userData.email,
          password: hashedPassword,
          employeeId: userData.employeeId,
          role: userData.role,
          departmentId: departmentId,
          phoneNumber: userData.phoneNumber || "",
          isActive: true,
          firstLogin: true,
        });

        successCount++;
        console.log(`✅ Imported user: ${userData.email}`);
      } catch (error) {
        console.error(`Error importing ${userData.email}:`, error.message);
        errors.push(`${userData.email} - ${error.message}`);
        failedCount++;
      }
    }

    res.json({
      success: true,
      message: `Imported ${successCount} users, failed ${failedCount}`,
      successCount,
      failedCount,
      errors,
    });
  } catch (error) {
    console.error("Bulk import error:", error);
    res
      .status(500)
      .json({ success: false, message: "Import failed: " + error.message });
  }
};

// ============ EXPORTS ============
module.exports = {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  completeOnboarding,
  getAllUsers,
  getMe,
  updateUser,
  deleteUser,
  changeUserRole,
  getDemoUsers,
  updateMyProfile,
  getUserProfile,
  uploadProfilePhoto,
  exportUsers,
  bulkImportUsers,
};
