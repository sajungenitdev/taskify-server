const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User } = require("../models/User.model");

// ============ GET ACTIVE USERS ============
const getActiveUsers = async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select("fullName email role employeeId")
      .sort({ role: 1, fullName: 1 });

    const formattedUsers = users.map((user) => ({
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      badge:
        user.role === "super_admin"
          ? "Full Access"
          : user.role === "admin"
            ? "Management"
            : user.role === "hr_manager"
              ? "HR Panel"
              : user.role === "dept_manager"
                ? "Team Lead"
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
      { expiresIn: "7d" },
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
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "No token provided" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (!user || !user.isActive) {
        return res
          .status(401)
          .json({ success: false, message: "User not found" });
      }

      const newToken = jwt.sign(
        { userId: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" },
      );

      res.json({ success: true, data: { accessToken: newToken } });
    } catch (err) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ LOGOUT ============
const logout = async (req, res) => {
  try {
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ GET ALL USERS ============
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json({ success: true, data: users, count: users.length });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ GET CURRENT USER ============
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    res.json({ success: true, data: user });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ REGISTER ============
const register = async (req, res) => {
  try {
    const { fullName, email, password, employeeId, role } = req.body;

    const existingUser = await User.findOne({
      $or: [{ email }, { employeeId }],
    });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullName,
      email,
      password: hashedPassword,
      employeeId,
      role: role || "employee",
      isActive: true,
    });

    const userResponse = user.toObject();
    delete userResponse.password;

    res
      .status(201)
      .json({ success: true, message: "User registered", data: userResponse });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ UPDATE USER ============
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phoneNumber, role, isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { fullName, phoneNumber, role, isActive },
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

// ============ DELETE USER ============
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

// ============ CHANGE USER ROLE ============
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

    res.json({ success: true, message: "Onboarding completed" });
  } catch (error) {
    console.error("Onboarding error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ UPDATE MY PROFILE ============
const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const updates = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true },
    ).select("-password");

    res.json({ success: true, message: "Profile updated", data: user });
  } catch (error) {
    console.error("Update profile error:", error);
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

// ============ FORGOT PASSWORD ============
const forgotPassword = async (req, res) => {
  try {
    res.json({ success: true, message: "Password reset link sent" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ RESET PASSWORD ============
const resetPassword = async (req, res) => {
  try {
    res.json({ success: true, message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ EXPORT USERS ============
const exportUsers = async (req, res) => {
  try {
    res.json({ success: true, message: "Export endpoint" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ BULK IMPORT ============
const bulkImportUsers = async (req, res) => {
  try {
    res.json({ success: true, message: "Import endpoint" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============ GET USER PROFILE ============
const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-password");
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
  getUserProfile, // Make sure this is exported
  updateUser,
  deleteUser,
  changeUserRole,
  getActiveUsers,
  updateMyProfile,
  uploadProfilePhoto,
  exportUsers,
  bulkImportUsers,
};
