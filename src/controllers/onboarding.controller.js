const { User } = require("../models/user.model");
const { Department } = require("../models/department.model");

/**
 * Get onboarding status for current user
 */
exports.getOnboardingStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("onboardingCompleted onboardingStep");

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
      // Profile Setup
      fullName,
      phone,
      location,
      department,
      position,
      employeeId,
      bio,
      
      // Daily Hours Target
      dailyHoursTarget,
      weeklyHoursTarget,
      startTime,
      endTime,
      breakDuration,
      workDays,
      timezone,
      overtimeThreshold,
      
      // Notification Preferences
      emailNotifications,
      pushNotifications,
      taskReminders,
      taskReminderTime,
      leaveApprovals,
      teamUpdates,
      dailyDigest,
      weeklyReport,
      mentionNotifications,
      commentNotifications,
    } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update user profile
    user.fullName = fullName || user.fullName;
    user.phone = phone || user.phone;
    user.location = location || user.location;
    
    if (department) {
      user.departmentId = department;
    }
    
    user.position = position || user.position;
    user.employeeId = employeeId || user.employeeId;
    user.bio = bio || user.bio;

    // Update working hours settings
    user.settings = {
      ...user.settings,
      dailyHoursTarget: dailyHoursTarget || 8,
      weeklyHoursTarget: weeklyHoursTarget || 40,
      startTime: startTime || "09:00",
      endTime: endTime || "18:00",
      breakDuration: breakDuration || 60,
      workDays: workDays || ["monday", "tuesday", "wednesday", "thursday", "friday"],
      timezone: timezone || "UTC+06:00",
      overtimeThreshold: overtimeThreshold || 2,
    };

    // Update notification preferences
    user.notificationPreferences = {
      emailNotifications: emailNotifications !== undefined ? emailNotifications : true,
      pushNotifications: pushNotifications !== undefined ? pushNotifications : true,
      taskReminders: taskReminders !== undefined ? taskReminders : true,
      taskReminderTime: taskReminderTime || "09:00",
      leaveApprovals: leaveApprovals !== undefined ? leaveApprovals : true,
      teamUpdates: teamUpdates !== undefined ? teamUpdates : true,
      dailyDigest: dailyDigest !== undefined ? dailyDigest : true,
      weeklyReport: weeklyReport !== undefined ? weeklyReport : true,
      mentionNotifications: mentionNotifications !== undefined ? mentionNotifications : true,
      commentNotifications: commentNotifications !== undefined ? commentNotifications : true,
    };

    // Mark onboarding as completed
    user.onboardingCompleted = true;
    user.onboardingStep = 3;

    await user.save();

    res.json({
      success: true,
      message: "Onboarding completed successfully",
      data: {
        onboardingCompleted: true,
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