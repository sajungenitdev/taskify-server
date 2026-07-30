// controllers/auth.controller.js
// ============================================================
// COMPLETE AUTH CONTROLLER - FULLY FUNCTIONAL
// ============================================================

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User } = require("../models/User.model");
const { Project } = require("../models/Project.model");
const { Role } = require("../models/Role.model");
const crypto = require("crypto");
const { sendEmail } = require("../config/email.config");
const EmailTemplates = require("../services/emailTemplates.service");

// ============================================================
// HELPER FUNCTIONS
// ============================================================
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
  delete userObj.resetPasswordToken;
  delete userObj.resetPasswordExpires;
  delete userObj.refreshToken;
  return userObj;
};

const ensureProfilePhoto = (userObj) => {
  if (!userObj.profilePhoto && userObj.avatar) {
    userObj.profilePhoto = userObj.avatar;
  }
  return userObj;
};

// ============================================================
// GET ACTIVE USERS
// ============================================================
const getActiveUsers = async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select("-password")
      .populate("department", "name code")
      .populate("roles", "name code level")
      .sort({ role: 1, fullName: 1 });

    const formattedUsers = users.map((user) => {
      const userObj = user.toObject();
      return {
        _id: userObj._id,
        id: userObj._id,
        fullName: userObj.fullName,
        email: userObj.email,
        role: userObj.role,
        employeeId: userObj.employeeId,
        department: userObj.department,
        roles: userObj.roles || [],
        isActive: userObj.isActive,
        profilePhoto: userObj.profilePhoto || userObj.avatar || null,
        badge:
          userObj.role === "super_admin"
            ? "Full Access"
            : userObj.role === "admin"
              ? "Management"
              : userObj.role === "hr_manager"
                ? "HR Panel"
                : userObj.role === "dept_manager"
                  ? "Team Lead"
                  : userObj.role === "project_manager"
                    ? "Project Lead"
                    : userObj.role === "line_manager"
                      ? "Line Manager"
                      : "Staff Access",
      };
    });

    res.json({
      success: true,
      data: formattedUsers,
      count: formattedUsers.length,
    });
  } catch (error) {
    console.error("Get active users error:", error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
};

// ============================================================
// LOGIN
// ============================================================
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() })
      .select("+password")
      .populate("department", "name code")
      .populate("roles", "name code level");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Your account has been deactivated. Please contact administrator.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);
    let userResponse = sanitizeUser(user);
    userResponse = ensureProfilePhoto(userResponse);

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

// ============================================================
// REFRESH TOKEN
// ============================================================
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
      const user = await User.findById(decoded.userId)
        .populate("department", "name code")
        .populate("roles", "name code level");

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

// ============================================================
// LOGOUT
// ============================================================
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

// ============================================================
// GET CURRENT USER
// ============================================================
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("department", "name code")
      .populate("roles", "name code level");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let userObj = user.toObject();
    userObj = ensureProfilePhoto(userObj);

    res.json({
      success: true,
      data: userObj,
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ============================================================
// REGISTER NEW USER (Admin only)
// ============================================================
const register = async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      employeeId,
      role,
      department,
      phoneNumber,
      profilePhoto,
    } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, and password are required",
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { employeeId }],
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

    let userRole = role || "employee";
    let roleId = null;

    if (role) {
      const roleDoc = await Role.findOne({ code: role.toUpperCase() });
      if (roleDoc) {
        roleId = roleDoc._id;
      }
    } else {
      const defaultRole = await Role.findOne({ code: "EMPLOYEE" });
      if (defaultRole) {
        roleId = defaultRole._id;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const finalEmployeeId = employeeId || `EMP${Date.now()}`;

    const userData = {
      fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
      employeeId: finalEmployeeId,
      role: userRole,
      roles: roleId ? [roleId] : [],
      department: department || null,
      phoneNumber: phoneNumber || null,
      isActive: true,
      firstLogin: true,
    };

    if (profilePhoto) {
      userData.profilePhoto = profilePhoto;
      userData.avatar = profilePhoto;
    }

    const user = await User.create(userData);

    if (department) {
      const { Department } = require("../models/Department.model");
      const dept = await Department.findById(department);
      if (dept) {
        await dept.updateEmployeeCount();
      }
    }

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

// ============================================================
// GET ALL USERS
// ============================================================
const getAllUsers = async (req, res) => {
  try {
    const user = req.user;
    let query = {};

    // ========== ROLE-BASED FILTERING ==========
    if (
      user.role === "super_admin" ||
      user.role === "admin" ||
      user.role === "hr_manager"
    ) {
      // Can see all users
    } else if (user.role === "dept_manager") {
      if (user.department) {
        query.department = user.department;
      } else {
        return res.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 100, total: 0, pages: 0 },
        });
      }
    } else if (user.role === "project_manager") {
      const projects = await Project.find({
        projectManager: user._id,
      }).select("teamMembers");

      const teamMemberIds = projects.flatMap(
        (p) => p.teamMembers?.map((m) => m.userId) || [],
      );
      teamMemberIds.push(user._id);

      if (teamMemberIds.length > 0) {
        query._id = { $in: teamMemberIds };
      } else {
        return res.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 100, total: 0, pages: 0 },
        });
      }
    } else if (user.role === "line_manager") {
      const teamMembers = await User.find({ managerId: user._id }).select("_id");
      const memberIds = teamMembers.map((m) => m._id);
      memberIds.push(user._id);

      if (memberIds.length > 0) {
        query._id = { $in: memberIds };
      } else {
        return res.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 100, total: 0, pages: 0 },
        });
      }
    } else {
      query._id = user._id;
    }

    // Additional filters
    if (
      req.query.department &&
      (user.role === "super_admin" || user.role === "admin" || user.role === "hr_manager")
    ) {
      query.department = req.query.department;
    }

    if (
      req.query.role &&
      (user.role === "super_admin" || user.role === "admin" || user.role === "hr_manager")
    ) {
      query.role = req.query.role;
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, "i");
      query.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
        { employeeId: searchRegex },
      ];
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const users = await User.find(query)
      .select("-password")
      .populate("department", "name code")
      .populate("roles", "name code level")
      .populate("employment.manager", "fullName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    const usersWithPhoto = users.map((u) => {
      const obj = u.toObject();
      return ensureProfilePhoto(obj);
    });

    res.json({
      success: true,
      data: usersWithPhoto,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// ============================================================
// GET USER PROFILE BY ID
// ============================================================
const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id)
      .select("-password")
      .populate("department", "name code")
      .populate("roles", "name code level");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let userObj = user.toObject();
    userObj = ensureProfilePhoto(userObj);

    res.json({
      success: true,
      data: userObj,
    });
  } catch (error) {
    console.error("Get user profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// ============================================================
// UPDATE USER (Admin only)
// ============================================================
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phoneNumber, role, isActive, department, employeeId } = req.body;

    const currentUser = await User.findById(id);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const oldDepartment = currentUser.department?.toString();

    if (req.body.roles) {
      const roleDoc = await Role.findById(req.body.roles[0]);
      if (roleDoc) {
        req.body.role = roleDoc.code.toLowerCase();
      }
    }

    const user = await User.findByIdAndUpdate(
      id,
      {
        fullName,
        phoneNumber,
        role,
        isActive,
        department,
        employeeId,
        ...(req.body.roles && { roles: req.body.roles }),
      },
      { new: true, runValidators: true },
    )
      .select("-password")
      .populate("department", "name code")
      .populate("roles", "name code level");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (department && department !== oldDepartment) {
      const { Department } = require("../models/Department.model");
      if (oldDepartment) {
        const oldDept = await Department.findById(oldDepartment);
        if (oldDept) {
          await oldDept.updateEmployeeCount();
        }
      }
      if (department) {
        const newDept = await Department.findById(department);
        if (newDept) {
          await newDept.updateEmployeeCount();
        }
      }
    }

    let userObj = user.toObject();
    userObj = ensureProfilePhoto(userObj);

    res.json({
      success: true,
      message: "User updated successfully",
      data: userObj,
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// ============================================================
// DELETE USER (Super Admin only)
// ============================================================
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const department = user.department;

    await User.findByIdAndDelete(id);

    if (department) {
      const { Department } = require("../models/Department.model");
      const dept = await Department.findById(department);
      if (dept) {
        await dept.updateEmployeeCount();
      }
    }

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// ============================================================
// CHANGE USER ROLE (Super Admin only)
// ============================================================
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

    const user = await User.findByIdAndUpdate(id, { role }, { new: true })
      .select("-password")
      .populate("department", "name code")
      .populate("roles", "name code level");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let userObj = user.toObject();
    userObj = ensureProfilePhoto(userObj);

    res.json({
      success: true,
      message: "User role updated successfully",
      data: userObj,
    });
  } catch (error) {
    console.error("Change role error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// ============================================================
// CHANGE PASSWORD
// ============================================================
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

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
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
      message: "Server error: " + error.message,
    });
  }
};

// ============================================================
// UPDATE MY PROFILE - COMPLETE FIX
// ============================================================
const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      fullName,
      phoneNumber,
      employeeId,
      department,
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
      profilePhoto,
    } = req.body;

    console.log("📝 Updating profile for user:", userId);
    console.log("📝 Received data:", {
      fullName,
      phoneNumber,
      bio,
      position,
      location,
      skills: skills?.length || 0,
      languages: languages?.length || 0,
      achievements: achievements?.length || 0,
      socialLinks: socialLinks ? Object.keys(socialLinks) : [],
      hasProfilePhoto: !!profilePhoto,
    });

    const updates = {};

    // ✅ Basic fields
    if (fullName !== undefined) updates.fullName = fullName;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
    if (employeeId !== undefined) updates.employeeId = employeeId;
    if (department !== undefined) updates.department = department;
    if (bio !== undefined) updates.bio = bio;
    if (position !== undefined) updates.position = position;
    if (location !== undefined) updates.location = location;
    if (website !== undefined) updates.website = website;
    if (dailyHoursTarget !== undefined) updates.dailyHoursTarget = dailyHoursTarget;

    // ✅ Address
    if (address !== undefined) {
      updates.address = {
        street: address.street || '',
        city: address.city || '',
        state: address.state || '',
        country: address.country || '',
        zipCode: address.zipCode || '',
      };
    }

    // ✅ Emergency Contact
    if (emergencyContact !== undefined) {
      updates.emergencyContact = {
        name: emergencyContact.name || '',
        relationship: emergencyContact.relationship || '',
        phone: emergencyContact.phone || '',
        email: emergencyContact.email || '',
      };
    }

    // ✅ Social Links - ensure it's an object
    if (socialLinks !== undefined) {
      updates.socialLinks = {
        linkedin: socialLinks.linkedin || '',
        github: socialLinks.github || '',
        twitter: socialLinks.twitter || '',
        facebook: socialLinks.facebook || '',
        instagram: socialLinks.instagram || '',
      };
    }

    // ✅ Skills - ensure it's an array
    if (skills !== undefined) {
      updates.skills = Array.isArray(skills) ? skills : [];
    }

    // ✅ Languages - ensure it's an array
    if (languages !== undefined) {
      updates.languages = Array.isArray(languages) ? languages : [];
    }

    // ✅ Achievements - ensure it's an array of objects
    if (achievements !== undefined) {
      updates.achievements = Array.isArray(achievements) ? achievements.map(a => ({
        title: a.title || '',
        date: a.date || new Date().toISOString().split('T')[0],
        description: a.description || '',
      })) : [];
    }

    // ✅ Notification Preferences
    if (notificationPreferences !== undefined) {
      updates.notificationPreferences = {
        email: notificationPreferences.email !== undefined ? notificationPreferences.email : true,
        push: notificationPreferences.push !== undefined ? notificationPreferences.push : true,
        desktop: notificationPreferences.desktop !== undefined ? notificationPreferences.desktop : false,
        taskReminder: notificationPreferences.taskReminder !== undefined ? notificationPreferences.taskReminder : true,
        deadlineAlert: notificationPreferences.deadlineAlert !== undefined ? notificationPreferences.deadlineAlert : true,
        teamUpdate: notificationPreferences.teamUpdate !== undefined ? notificationPreferences.teamUpdate : true,
      };
    }

    // ✅ Profile Photo (Base64)
    if (profilePhoto !== undefined) {
      if (profilePhoto && !profilePhoto.startsWith('data:image/')) {
        return res.status(400).json({
          success: false,
          message: "Invalid image format. Must be base64 data URL.",
        });
      }
      updates.profilePhoto = profilePhoto;
      updates.avatar = profilePhoto;
    }

    // ✅ Remove undefined values
    Object.keys(updates).forEach(key => {
      if (updates[key] === undefined || updates[key] === null) {
        delete updates[key];
      }
    });

    // ✅ If no updates, return early
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    console.log("📝 Applying updates:", Object.keys(updates));

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true },
    )
      .select("-password")
      .populate("department", "name code")
      .populate("roles", "name code level")
      .populate("employment.manager", "fullName email");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let userObj = user.toObject();
    userObj = ensureProfilePhoto(userObj);

    console.log("✅ Profile updated successfully for:", userObj.email);

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: userObj,
    });
  } catch (error) {
    console.error("❌ Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// ============================================================
// UPLOAD PROFILE PHOTO (Base64 Only)
// ============================================================
const uploadProfilePhoto = async (req, res) => {
  try {
    const { profilePhoto } = req.body;

    // ✅ Validate base64 image
    if (!profilePhoto) {
      return res.status(400).json({
        success: false,
        message: "Profile photo (base64) is required",
      });
    }

    // ✅ Check if it's a valid base64 image
    if (!profilePhoto.startsWith('data:image/')) {
      return res.status(400).json({
        success: false,
        message: "Invalid image format. Must be base64 data URL starting with 'data:image/'",
      });
    }

    // ✅ Validate image size
    try {
      const base64Data = profilePhoto.split(',')[1];
      if (base64Data) {
        const base64Size = Buffer.from(base64Data, 'base64').length;
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (base64Size > maxSize) {
          return res.status(400).json({
            success: false,
            message: "Image size too large. Maximum 5MB allowed.",
          });
        }
      }
    } catch (err) {
      console.warn("Could not validate image size:", err);
    }

    // ✅ Update user with base64 image
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        profilePhoto: profilePhoto,
        avatar: profilePhoto,
      },
      { new: true },
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let userObj = user.toObject();
    userObj = ensureProfilePhoto(userObj);

    res.json({
      success: true,
      message: "Profile photo updated successfully",
      data: {
        profilePhoto: userObj.profilePhoto,
        avatar: userObj.avatar,
      },
    });
  } catch (error) {
    console.error("Upload photo error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// ============================================================
// COMPLETE ONBOARDING
// ============================================================
const completeOnboarding = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      fullName,
      phoneNumber,
      dailyHoursTarget,
      notificationPreferences,
      profilePhoto,
      position,
      employeeId,
      location,
      bio,
      department,
    } = req.body;

    const updates = {
      fullName: fullName || req.user.fullName,
      phoneNumber: phoneNumber || null,
      dailyHoursTarget: dailyHoursTarget || 8,
      notificationPreferences: notificationPreferences || {
        email: true,
        push: true,
        taskReminders: true,
      },
      firstLogin: false,
      onboardingCompleted: true,
    };

    if (position) updates.position = position;
    if (employeeId) updates.employeeId = employeeId;
    if (location) updates.location = location;
    if (bio) updates.bio = bio;
    if (department) updates.department = department;

    if (profilePhoto) {
      if (!profilePhoto.startsWith('data:image/')) {
        return res.status(400).json({
          success: false,
          message: "Invalid image format. Must be base64 data URL.",
        });
      }
      updates.profilePhoto = profilePhoto;
      updates.avatar = profilePhoto;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true },
    )
      .select("-password")
      .populate("department", "name code")
      .populate("roles", "name code level");

    let userObj = user.toObject();
    userObj = ensureProfilePhoto(userObj);

    res.json({
      success: true,
      message: "Onboarding completed successfully",
      data: userObj,
    });
  } catch (error) {
    console.error("Onboarding error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// ============================================================
// FORGOT PASSWORD
// ============================================================
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({
        success: true,
        message: "If your email is registered, you will receive a password reset link",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpires = Date.now() + 3600000;

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetExpires;
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password/${resetToken}`;

    const emailContent = `
      <div class="header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 20px 20px 0 0;">
        <h1 style="font-size: 28px; margin-bottom: 10px;">🔐 Password Reset</h1>
        <p>Reset your TaskManager account password</p>
      </div>
      <div class="content" style="padding: 40px 30px; background: #ffffff;">
        <p>Hello <strong>${user.fullName}</strong>,</p>
        <p>We received a request to reset your password. Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: 600;">Reset Password</a>
        </div>
        <p>Or copy and paste this link in your browser:</p>
        <p style="word-break: break-all; font-size: 12px; color: #64748b; background: #f1f5f9; padding: 10px; border-radius: 5px;">${resetUrl}</p>
        <p style="margin-top: 20px;">This link will expire in <strong>1 hour</strong>.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 14px; color: #64748b;">For security, this link can only be used once.</p>
      </div>
    `;

    await sendEmail(
      user.email,
      "🔐 Password Reset Request",
      EmailTemplates.getBaseTemplate(emailContent, "Password Reset"),
    );

    res.json({
      success: true,
      message: "Password reset link sent to your email",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// ============================================================
// RESET PASSWORD
// ============================================================
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (!password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Password and confirm password are required",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token. Please request a new one.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    const confirmContent = `
      <div class="header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 20px 20px 0 0;">
        <h1 style="font-size: 28px; margin-bottom: 10px;">✅ Password Reset Successful</h1>
        <p>Your password has been changed</p>
      </div>
      <div class="content" style="padding: 40px 30px; background: #ffffff;">
        <p>Hello <strong>${user.fullName}</strong>,</p>
        <div style="background: #d1fae5; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
          <p style="font-size: 48px;">🔐</p>
          <p style="color: #065f46;">Your password has been successfully reset.</p>
        </div>
        <p>If you did not perform this action, please contact support immediately.</p>
        <div style="text-align: center; margin-top: 30px;">
          <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/login" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: 600;">Sign In</a>
        </div>
      </div>
    `;

    await sendEmail(
      user.email,
      "✅ Password Reset Successful",
      EmailTemplates.getBaseTemplate(confirmContent, "Password Reset Success"),
    );

    res.json({
      success: true,
      message: "Password reset successfully. You can now login with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// ============================================================
// EXPORT USERS
// ============================================================
const exportUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .populate("department", "name code")
      .populate("roles", "name code level");

    const csvData = users.map((user) => {
      const obj = user.toObject();
      return {
        "Full Name": obj.fullName,
        Email: obj.email,
        Role: obj.role,
        "Employee ID": obj.employeeId,
        Department: obj.department?.name || "N/A",
        Status: obj.isActive ? "Active" : "Inactive",
        "Last Login": obj.lastLogin
          ? new Date(obj.lastLogin).toLocaleDateString()
          : "Never",
        "Created At": new Date(obj.createdAt).toLocaleDateString(),
      };
    });

    res.json({
      success: true,
      data: csvData,
      count: csvData.length,
    });
  } catch (error) {
    console.error("Export users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// ============================================================
// BULK IMPORT USERS
// ============================================================
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

    const departmentsToUpdate = new Set();

    for (const userData of users) {
      try {
        const { fullName, email, password, employeeId, role, department } = userData;

        const existingUser = await User.findOne({
          $or: [{ email: email.toLowerCase() }, { employeeId }],
        });
        if (existingUser) {
          results.failed.push({ ...userData, error: "User already exists" });
          continue;
        }

        let roleId = null;
        if (role) {
          const roleDoc = await Role.findOne({ code: role.toUpperCase() });
          if (roleDoc) {
            roleId = roleDoc._id;
          }
        } else {
          const defaultRole = await Role.findOne({ code: "EMPLOYEE" });
          if (defaultRole) {
            roleId = defaultRole._id;
          }
        }

        const hashedPassword = await bcrypt.hash(password || "Temp@123", 10);

        const user = await User.create({
          fullName,
          email: email.toLowerCase(),
          password: hashedPassword,
          employeeId: employeeId || `EMP${Date.now()}`,
          role: role || "employee",
          roles: roleId ? [roleId] : [],
          department: department || null,
          isActive: true,
        });

        if (department) {
          departmentsToUpdate.add(department.toString());
        }

        results.successful.push(sanitizeUser(user));
      } catch (error) {
        results.failed.push({ ...userData, error: error.message });
      }
    }

    if (departmentsToUpdate.size > 0) {
      const { Department } = require("../models/Department.model");
      for (const deptId of departmentsToUpdate) {
        const dept = await Department.findById(deptId);
        if (dept) {
          await dept.updateEmployeeCount();
        }
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
      message: "Server error: " + error.message,
    });
  }
};

// ============================================================
// EXPORTS
// ============================================================
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