const { User } = require("../models/User.model");
const { Department } = require("../models/Department.model");

/**
 * Get onboarding status for current user
 */
exports.getOnboardingStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "onboardingCompleted onboardingStep",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: {
        onboardingCompleted: user.onboardingCompleted || false,
        onboardingStep: user.onboardingStep || 1,
      },
    });
  } catch (error) {
    console.error("Error getting onboarding status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get onboarding status",
    });
  }
};

/**
 * Complete onboarding process
 */
exports.completeOnboarding = async (req, res) => {
  try {
    const {
      fullName,
      phoneNumber,
      location,
      departmentId,
      position,
      employeeId,
      bio,
      dailyHoursTarget,
      workSettings,
      notificationPreferences,
      profilePhoto,
      onboardingCompleted,
      firstLogin,
    } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Validate department if provided
    if (departmentId) {
      const department = await Department.findById(departmentId);
      if (!department) {
        return res.status(400).json({
          success: false,
          message: "Invalid department ID",
        });
      }
    }

    // Update basic profile
    if (fullName) user.fullName = fullName;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (location) user.location = location;
    if (departmentId) user.departmentId = departmentId;
    if (position) user.position = position;
    if (employeeId) user.employeeId = employeeId;
    if (bio) user.bio = bio;

    // Update daily hours target if provided
    if (dailyHoursTarget) {
      user.dailyHoursTarget = dailyHoursTarget;
    }

    // Update work settings
    user.workSettings = {
      dailyHoursTarget:
        workSettings?.dailyHoursTarget ||
        user.workSettings?.dailyHoursTarget ||
        8,
      weeklyHoursTarget:
        workSettings?.weeklyHoursTarget ||
        user.workSettings?.weeklyHoursTarget ||
        40,
      startTime:
        workSettings?.startTime || user.workSettings?.startTime || "09:00",
      endTime: workSettings?.endTime || user.workSettings?.endTime || "18:00",
      breakDuration:
        workSettings?.breakDuration || user.workSettings?.breakDuration || 60,
      workDays: workSettings?.workDays ||
        user.workSettings?.workDays || [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
        ],
      timezone:
        workSettings?.timezone || user.workSettings?.timezone || "UTC+06:00",
      overtimeThreshold:
        workSettings?.overtimeThreshold ||
        user.workSettings?.overtimeThreshold ||
        2,
    };

    // Update notification preferences
    user.notificationPreferences = {
      email:
        notificationPreferences?.email ??
        user.notificationPreferences?.email ??
        true,
      push:
        notificationPreferences?.push ??
        user.notificationPreferences?.push ??
        true,
      desktop:
        notificationPreferences?.desktop ??
        user.notificationPreferences?.desktop ??
        false,
      taskReminder:
        notificationPreferences?.taskReminder ??
        user.notificationPreferences?.taskReminder ??
        true,
      taskReminderTime:
        notificationPreferences?.taskReminderTime ||
        user.notificationPreferences?.taskReminderTime ||
        "09:00",
      deadlineAlert:
        notificationPreferences?.deadlineAlert ??
        user.notificationPreferences?.deadlineAlert ??
        true,
      leaveApprovals:
        notificationPreferences?.leaveApprovals ??
        user.notificationPreferences?.leaveApprovals ??
        true,
      teamUpdate:
        notificationPreferences?.teamUpdate ??
        user.notificationPreferences?.teamUpdate ??
        true,
      dailyDigest:
        notificationPreferences?.dailyDigest ??
        user.notificationPreferences?.dailyDigest ??
        true,
      weeklyReport:
        notificationPreferences?.weeklyReport ??
        user.notificationPreferences?.weeklyReport ??
        true,
      mentionNotifications:
        notificationPreferences?.mentionNotifications ??
        user.notificationPreferences?.mentionNotifications ??
        true,
      commentNotifications:
        notificationPreferences?.commentNotifications ??
        user.notificationPreferences?.commentNotifications ??
        true,
    };

    // Update profile photo if provided (base64)
    if (profilePhoto) {
      user.profilePhoto = profilePhoto;
    }

    // Mark onboarding as completed
    user.onboardingCompleted = onboardingCompleted ?? true;
    user.firstLogin = firstLogin ?? false;
    user.onboardingStep = 3;

    await user.save();

    res.json({
      success: true,
      message: "Onboarding completed successfully",
      data: {
        onboardingCompleted: user.onboardingCompleted,
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          department: user.departmentId,
          position: user.position,
        },
      },
    });
  } catch (error) {
    console.error("Error completing onboarding:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to complete onboarding",
    });
  }
};

/**
 * Skip onboarding (for testing purposes)
 */
exports.skipOnboarding = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.onboardingCompleted = true;
    user.firstLogin = false;
    user.onboardingStep = 3;
    await user.save();

    res.json({
      success: true,
      message: "Onboarding skipped successfully",
    });
  } catch (error) {
    console.error("Error skipping onboarding:", error);
    res.status(500).json({
      success: false,
      message: "Failed to skip onboarding",
    });
  }
};
