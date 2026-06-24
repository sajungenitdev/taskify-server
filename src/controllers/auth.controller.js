const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User } = require("../models/User.model");

// ============ HELPER FUNCTIONS ============
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );
};

const sanitizeUser = (user) => {
  const userObj = user.toObject ? user.toObject() : { ...user };
  delete userObj.password;
  return userObj;
};

// ============ GET ACTIVE USERS ============
const getActiveUsers = async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select("-password")
      .populate("departmentId", "name code")
      .sort({ role: 1, fullName: 1 });

    const formattedUsers = users.map((user) => ({
      _id: user._id,
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      departmentId: user.departmentId,
      isActive: user.isActive,
      badge:
        user.role === "super_admin"
          ? "Full Access"
          : user.role === "admin"
            ? "Management"
            : user.role === "hr_manager"
              ? "HR Panel"
              : user.role === "dept_manager"
                ? "Team Lead"
                : user.role === "project_manager"
                  ? "Project Lead"
                  : user.role === "line_manager"
                    ? "Line Manager"
                    : "Staff Access",
    }));

    res.json({
      success: true,
      data: formattedUsers,
      count: formattedUsers.length,
    });
  } catch (error) {
    console.error("Get active users error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ LOGIN ============
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find user with password field
    const user = await User.findOne({ email })
      .select("+password")
      .populate("departmentId", "name code");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message:
          "Your account has been deactivated. Please contact administrator.",
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user);

    // Prepare user response (without password)
    const userResponse = sanitizeUser(user);

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: userResponse,
        accessToken: token,
        token,
        firstLogin: user.firstLogin === true,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// ============ REFRESH TOKEN ============
const refreshToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: "User not found or inactive",
        });
      }

      const newToken = generateToken(user);

      res.json({
        success: true,
        data: { accessToken: newToken, token: newToken },
      });
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ============ LOGOUT ============
const logout = async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ============ GET ALL USERS (Admin only) ============
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .populate("departmentId", "name code")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: users,
      count: users.length,
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ============ GET CURRENT USER ============
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("departmentId", "name code");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ============ REGISTER NEW USER (Admin only) ============
const register = async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      employeeId,
      role,
      departmentId,
      phoneNumber,
    } = req.body;

    // Validate required fields
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, and password are required",
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { employeeId }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message:
          existingUser.email === email
            ? "User with this email already exists"
            : "Employee ID already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate employee ID if not provided
    const finalEmployeeId = employeeId || `EMP${Date.now()}`;

    // Create user
    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
      employeeId: finalEmployeeId,
      role: role || "employee",
      departmentId: departmentId || null,
      phoneNumber: phoneNumber || null,
      isActive: true,
      firstLogin: true,
    });

    const userResponse = sanitizeUser(user);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: userResponse,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// ============ UPDATE USER (Admin only) ============
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phoneNumber, role, isActive, departmentId, employeeId } =
      req.body;

    const user = await User.findByIdAndUpdate(
      id,
      {
        fullName,
        phoneNumber,
        role,
        isActive,
        departmentId,
        employeeId,
      },
      { new: true, runValidators: true },
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ============ DELETE USER (Admin only) ============
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ============ CHANGE USER ROLE (Admin only) ============
const changeUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = [
      "super_admin",
      "admin",
      "dept_manager",
      "project_manager",
      "line_manager",
      "employee",
      "hr_manager",
    ];

    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be one of: " + validRoles.join(", "),
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true },
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User role updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("Change role error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ============ CHANGE PASSWORD ============
const changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
    }

    const user = await User.findById(userId).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ============ COMPLETE ONBOARDING ============
const completeOnboarding = async (req, res) => {
  try {
    const userId = req.user._id;
    const { fullName, phoneNumber, dailyHoursTarget, notificationPreferences } =
      req.body;

    await User.findByIdAndUpdate(userId, {
      fullName: fullName || req.user.fullName,
      phoneNumber: phoneNumber || null,
      dailyHoursTarget: dailyHoursTarget || 8,
      notificationPreferences: notificationPreferences || {
        email: true,
        push: true,
        taskReminders: true,
      },
      firstLogin: false,
    });

    res.json({
      success: true,
      message: "Onboarding completed successfully",
    });
  } catch (error) {
    console.error("Onboarding error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ============ UPDATE MY PROFILE ============
// ============ UPDATE MY PROFILE ============
const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      fullName,
      phoneNumber,
      employeeId,
      departmentId,
      bio,
      position,
      location,
      website,
      socialLinks,
      address,
      emergencyContact,
      skills,
      languages,
      achievements,
      notificationPreferences,
      dailyHoursTarget,
    } = req.body;

    const updates = {};

    // Only add fields that are provided
    if (fullName !== undefined) updates.fullName = fullName;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
    if (employeeId !== undefined) updates.employeeId = employeeId;
    if (departmentId !== undefined) updates.departmentId = departmentId;
    if (bio !== undefined) updates.bio = bio;
    if (position !== undefined) updates.position = position;
    if (location !== undefined) updates.location = location;
    if (website !== undefined) updates.website = website;
    if (socialLinks !== undefined) updates.socialLinks = socialLinks;
    if (address !== undefined) updates.address = address;
    if (emergencyContact !== undefined)
      updates.emergencyContact = emergencyContact;
    if (skills !== undefined) updates.skills = skills;
    if (languages !== undefined) updates.languages = languages;
    if (achievements !== undefined) updates.achievements = achievements;
    if (notificationPreferences !== undefined)
      updates.notificationPreferences = notificationPreferences;
    if (dailyHoursTarget !== undefined)
      updates.dailyHoursTarget = dailyHoursTarget;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true },
    )
      .select("-password")
      .populate("departmentId", "name code");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// ============ UPLOAD PROFILE PHOTO ============
const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const photoUrl = `/uploads/profiles/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profilePhoto: photoUrl },
      { new: true },
    ).select("-password");

    res.json({
      success: true,
      message: "Profile photo updated successfully",
      data: { profilePhoto: user.profilePhoto },
    });
  } catch (error) {
    console.error("Upload photo error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ============ FORGOT PASSWORD ============
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        success: true,
        message:
          "If your email is registered, you will receive a password reset link",
      });
    }

    // Generate reset token (implement with email service)
    const resetToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // TODO: Send email with reset link
    // For now, just return the token (in production, send via email)

    res.json({
      success: true,
      message: "Password reset link sent to your email",
      // Remove this in production, only for testing
      ...(process.env.NODE_ENV === "development" && { resetToken }),
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ============ RESET PASSWORD ============
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Token and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();

      res.json({
        success: true,
        message: "Password reset successfully",
      });
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ============ GET USER PROFILE BY ID ============
const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id)
      .select("-password")
      .populate("departmentId", "name code");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Get user profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ============ EXPORT USERS ============
const exportUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .populate("departmentId", "name code");

    const csvData = users.map((user) => ({
      "Full Name": user.fullName,
      Email: user.email,
      Role: user.role,
      "Employee ID": user.employeeId,
      Department: user.departmentId?.name || "N/A",
      Status: user.isActive ? "Active" : "Inactive",
      "Last Login": user.lastLogin
        ? new Date(user.lastLogin).toLocaleDateString()
        : "Never",
      "Created At": new Date(user.createdAt).toLocaleDateString(),
    }));

    res.json({
      success: true,
      data: csvData,
      count: csvData.length,
    });
  } catch (error) {
    console.error("Export users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ============ BULK IMPORT USERS ============
const bulkImportUsers = async (req, res) => {
  try {
    const { users } = req.body;

    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Users array is required",
      });
    }

    const results = {
      successful: [],
      failed: [],
    };

    for (const userData of users) {
      try {
        const { fullName, email, password, employeeId, role, departmentId } =
          userData;

        // Check if user exists
        const existingUser = await User.findOne({
          $or: [{ email }, { employeeId }],
        });
        if (existingUser) {
          results.failed.push({ ...userData, error: "User already exists" });
          continue;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password || "Temp@123", 10);

        // Create user
        const user = await User.create({
          fullName,
          email: email.toLowerCase(),
          password: hashedPassword,
          employeeId: employeeId || `EMP${Date.now()}`,
          role: role || "employee",
          departmentId: departmentId || null,
          isActive: true,
        });

        results.successful.push(sanitizeUser(user));
      } catch (error) {
        results.failed.push({ ...userData, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Imported ${results.successful.length} users, ${results.failed.length} failed`,
      data: results,
    });
  } catch (error) {
    console.error("Bulk import error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
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
  getUserProfile,
  updateUser,
  deleteUser,
  changeUserRole,
  getActiveUsers,
  updateMyProfile,
  uploadProfilePhoto,
  exportUsers,
  bulkImportUsers,
};
