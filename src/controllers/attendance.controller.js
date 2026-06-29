// controllers/attendance.controller.js

const { Attendance, attendanceStatus } = require("../models/Attendance.model");
const { User } = require("../models/User.model");
const moment = require("moment");

// ============================================================================
// EMPLOYEE ATTENDANCE ROUTES
// ============================================================================

// Get today's attendance for an employee
const getTodayAttendance = async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const attendance = await Attendance.findOne({
      employeeId: userId,
      date: { $gte: today, $lt: tomorrow },
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "No attendance record for today",
        data: null,
      });
    }

    res.json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    console.error("Get today attendance error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get attendance",
    });
  }
};

// Start timer - Check In
const startTimer = async (req, res) => {
  try {
    const userId = req.user._id;
    const { location, checkInLocation } = req.body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if attendance already exists for today
    let attendance = await Attendance.findOne({
      employeeId: userId,
      date: { $gte: today, $lt: tomorrow },
    });

    if (attendance) {
      // If attendance exists but no check-in, update it
      if (!attendance.checkIn) {
        attendance.checkIn = new Date();
        attendance.timerStart = new Date();
        attendance.status = attendanceStatus.PRESENT;
        attendance.location = location || "Office";
        if (checkInLocation) {
          attendance.checkInLocation = checkInLocation;
        }
        await attendance.save();

        return res.json({
          success: true,
          message: "Timer started successfully",
          data: attendance,
        });
      }

      return res.status(400).json({
        success: false,
        message: "Timer already started for today",
        data: attendance,
      });
    }

    // Create new attendance record
    const user = await User.findById(userId).populate("departmentId");
    const newAttendance = new Attendance({
      employeeId: userId,
      employeeName: user.fullName,
      employeeEmail: user.email,
      employeeDepartment: user.departmentId?.name || "Unassigned",
      employeePosition: user.position || "",
      date: new Date(),
      checkIn: new Date(),
      timerStart: new Date(),
      status: attendanceStatus.PRESENT,
      location: location || "Office",
      checkInLocation: checkInLocation || {},
    });

    await newAttendance.save();

    res.status(201).json({
      success: true,
      message: "Timer started successfully",
      data: newAttendance,
    });
  } catch (error) {
    console.error("Start timer error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to start timer",
    });
  }
};

// Pause timer
const pauseTimer = async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const attendance = await Attendance.findOne({
      employeeId: userId,
      date: { $gte: today, $lt: tomorrow },
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "No active timer found",
      });
    }

    if (!attendance.checkIn) {
      return res.status(400).json({
        success: false,
        message: "You haven't checked in yet",
      });
    }

    if (attendance.timerPaused) {
      return res.status(400).json({
        success: false,
        message: "Timer is already paused",
      });
    }

    attendance.timerPaused = true;
    attendance.timerPausedAt = new Date();
    await attendance.save();

    res.json({
      success: true,
      message: "Timer paused successfully",
      data: attendance,
    });
  } catch (error) {
    console.error("Pause timer error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to pause timer",
    });
  }
};

// Resume timer
const resumeTimer = async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const attendance = await Attendance.findOne({
      employeeId: userId,
      date: { $gte: today, $lt: tomorrow },
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "No active timer found",
      });
    }

    if (!attendance.timerPaused) {
      return res.status(400).json({
        success: false,
        message: "Timer is not paused",
      });
    }

    // Calculate paused duration
    if (attendance.timerPausedAt) {
      const pausedDuration =
        new Date().getTime() - attendance.timerPausedAt.getTime();
      attendance.totalPausedDuration += pausedDuration;
    }

    attendance.timerPaused = false;
    attendance.timerPausedAt = null;
    await attendance.save();

    res.json({
      success: true,
      message: "Timer resumed successfully",
      data: attendance,
    });
  } catch (error) {
    console.error("Resume timer error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to resume timer",
    });
  }
};

// Check Out - Done Today
const checkOut = async (req, res) => {
  try {
    const userId = req.user._id;
    const { location, checkOutLocation, notes } = req.body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const attendance = await Attendance.findOne({
      employeeId: userId,
      date: { $gte: today, $lt: tomorrow },
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "No attendance record found for today",
      });
    }

    if (!attendance.checkIn) {
      return res.status(400).json({
        success: false,
        message: "You haven't checked in yet",
      });
    }

    if (attendance.checkOut) {
      return res.status(400).json({
        success: false,
        message: "You have already checked out for today",
      });
    }

    // Calculate total working time
    let totalWorkingMs = 0;
    if (attendance.timerStart) {
      // If timer is paused, calculate total working time
      if (attendance.timerPaused) {
        const pausedDuration =
          new Date().getTime() - attendance.timerPausedAt.getTime();
        totalWorkingMs =
          new Date().getTime() -
          attendance.timerStart.getTime() -
          attendance.totalPausedDuration -
          pausedDuration;
      } else {
        totalWorkingMs =
          new Date().getTime() -
          attendance.timerStart.getTime() -
          attendance.totalPausedDuration;
      }
    }

    // Calculate working hours in hours
    const workingHours = Math.max(0, totalWorkingMs / (1000 * 60 * 60));

    attendance.checkOut = new Date();
    attendance.timerPaused = false;
    attendance.totalWorkingTime = totalWorkingMs;
    attendance.workingHours = parseFloat(workingHours.toFixed(2));
    attendance.location = location || attendance.location;
    if (checkOutLocation) {
      attendance.checkOutLocation = checkOutLocation;
    }
    if (notes) {
      attendance.notes = notes;
    }

    // Calculate overtime (beyond 8 hours)
    const standardHours = 8;
    if (workingHours > standardHours) {
      attendance.overtime = parseFloat(
        (workingHours - standardHours).toFixed(2),
      );
    }

    await attendance.save();

    res.json({
      success: true,
      message: "Checked out successfully! Have a great day!",
      data: attendance,
    });
  } catch (error) {
    console.error("Check out error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to check out",
    });
  }
};

// Get timer status
const getTimerStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const attendance = await Attendance.findOne({
      employeeId: userId,
      date: { $gte: today, $lt: tomorrow },
    });

    if (!attendance) {
      return res.json({
        success: true,
        data: {
          isActive: false,
          isPaused: false,
          hasCheckedIn: false,
          hasCheckedOut: false,
          message: "No active timer",
        },
      });
    }

    // Calculate current working time
    let currentWorkingMs = attendance.totalWorkingTime || 0;
    let isPaused = attendance.timerPaused || false;
    let isActive = !!attendance.checkIn && !attendance.checkOut;

    if (isActive && !isPaused && attendance.timerStart) {
      const elapsedMs = new Date().getTime() - attendance.timerStart.getTime();
      currentWorkingMs += elapsedMs - (attendance.totalPausedDuration || 0);
    }

    const currentWorkingHours = parseFloat(
      (currentWorkingMs / (1000 * 60 * 60)).toFixed(2),
    );

    res.json({
      success: true,
      data: {
        isActive,
        isPaused,
        hasCheckedIn: !!attendance.checkIn,
        hasCheckedOut: !!attendance.checkOut,
        checkIn: attendance.checkIn,
        checkOut: attendance.checkOut,
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
        currentWorkingHours: currentWorkingHours,
        totalWorkingHours: attendance.workingHours || 0,
        overtime: attendance.overtime || 0,
        status: attendance.status,
        location: attendance.location,
        notes: attendance.notes,
        attendanceId: attendance._id,
      },
    });
  } catch (error) {
    console.error("Get timer status error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get timer status",
    });
  }
};

// ============================================================================
// ATTENDANCE HISTORY ROUTES
// ============================================================================

// Get employee's attendance history
const getEmployeeAttendance = async (req, res) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate, status, limit = 100, page = 1 } = req.query;

    const query = { employeeId: userId };

    if (startDate) {
      query.date = { ...query.date, $gte: new Date(startDate) };
    }
    if (endDate) {
      query.date = { ...query.date, $lte: new Date(endDate) };
    }
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const [attendance, total] = await Promise.all([
      Attendance.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Attendance.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: attendance,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get employee attendance error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get attendance history",
    });
  }
};

// Get attendance stats for an employee
const getEmployeeAttendanceStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      year = new Date().getFullYear(),
      month = new Date().getMonth() + 1,
    } = req.query;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const attendance = await Attendance.find({
      employeeId: userId,
      date: { $gte: startDate, $lte: endDate },
    });

    const stats = {
      total: attendance.length,
      present: attendance.filter((a) => a.status === attendanceStatus.PRESENT)
        .length,
      absent: attendance.filter((a) => a.status === attendanceStatus.ABSENT)
        .length,
      late: attendance.filter((a) => a.status === attendanceStatus.LATE).length,
      halfDay: attendance.filter((a) => a.status === attendanceStatus.HALF_DAY)
        .length,
      onLeave: attendance.filter((a) => a.status === attendanceStatus.ON_LEAVE)
        .length,
      totalWorkingHours: attendance.reduce(
        (sum, a) => sum + (a.workingHours || 0),
        0,
      ),
      totalOvertime: attendance.reduce((sum, a) => sum + (a.overtime || 0), 0),
      attendanceRate:
        attendance.length > 0
          ? Math.round(
              (attendance.filter(
                (a) =>
                  a.status === attendanceStatus.PRESENT ||
                  a.status === attendanceStatus.LATE,
              ).length /
                attendance.length) *
                100,
            )
          : 0,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Get attendance stats error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get attendance stats",
    });
  }
};

// ============================================================================
// ADMIN ROUTES
// ============================================================================

// Get all attendance records (Admin only)
const getAllAttendance = async (req, res) => {
  try {
    const {
      date,
      startDate,
      endDate,
      department,
      status,
      search,
      limit = 50,
      page = 1,
    } = req.query;

    const query = {};

    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      query.date = { $gte: targetDate, $lt: nextDay };
    } else if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (department) {
      query.employeeDepartment = department;
    }
    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { employeeName: { $regex: search, $options: "i" } },
        { employeeEmail: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [attendance, total] = await Promise.all([
      Attendance.find(query)
        .sort({ date: -1, checkIn: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate(
          "employeeId",
          "fullName email employeeId departmentId position",
        )
        .populate("createdBy", "fullName email"),
      Attendance.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: attendance,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all attendance error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get attendance records",
    });
  }
};

// Get attendance dashboard stats (Admin only)
const getAttendanceDashboardStats = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Get all employees
    const employees = await User.find({ isActive: true });
    const totalEmployees = employees.length;

    // Get today's attendance
    const todayAttendance = await Attendance.find({
      date: { $gte: targetDate, $lt: nextDay },
    });

    const present = todayAttendance.filter(
      (a) => a.status === attendanceStatus.PRESENT,
    ).length;
    const absent = todayAttendance.filter(
      (a) => a.status === attendanceStatus.ABSENT,
    ).length;
    const late = todayAttendance.filter(
      (a) => a.status === attendanceStatus.LATE,
    ).length;
    const halfDay = todayAttendance.filter(
      (a) => a.status === attendanceStatus.HALF_DAY,
    ).length;
    const onLeave = todayAttendance.filter(
      (a) => a.status === attendanceStatus.ON_LEAVE,
    ).length;

    // Calculate attendance rate
    const presentCount = present + late;
    const attendanceRate =
      totalEmployees > 0
        ? Math.round((presentCount / totalEmployees) * 100)
        : 0;

    res.json({
      success: true,
      data: {
        totalEmployees,
        present,
        absent,
        late,
        halfDay,
        onLeave,
        attendanceRate,
        totalWorkingHours: todayAttendance.reduce(
          (sum, a) => sum + (a.workingHours || 0),
          0,
        ),
        totalOvertime: todayAttendance.reduce(
          (sum, a) => sum + (a.overtime || 0),
          0,
        ),
      },
    });
  } catch (error) {
    console.error("Get attendance dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get attendance stats",
    });
  }
};

// Update attendance status (Admin only)
const updateAttendanceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!Object.values(attendanceStatus).includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    attendance.status = status;
    if (notes) {
      attendance.notes = notes;
    }
    attendance.updatedBy = req.user._id;

    await attendance.save();

    res.json({
      success: true,
      message: "Attendance status updated successfully",
      data: attendance,
    });
  } catch (error) {
    console.error("Update attendance status error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update attendance status",
    });
  }
};

// Export attendance data (Admin only)
const exportAttendance = async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;

    const query = {};
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }
    if (department) {
      query.employeeDepartment = department;
    }

    const attendance = await Attendance.find(query)
      .sort({ date: -1 })
      .populate("employeeId", "fullName email employeeId");

    res.json({
      success: true,
      data: attendance,
      count: attendance.length,
    });
  } catch (error) {
    console.error("Export attendance error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to export attendance",
    });
  }
};

module.exports = {
  getTodayAttendance,
  startTimer,
  pauseTimer,
  resumeTimer,
  checkOut,
  getTimerStatus,
  getEmployeeAttendance,
  getEmployeeAttendanceStats,
  getAllAttendance,
  getAttendanceDashboardStats,
  updateAttendanceStatus,
  exportAttendance,
};
