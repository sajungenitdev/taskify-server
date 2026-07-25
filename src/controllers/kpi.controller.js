// controllers/kpi.controller.js
const { KPIWeight } = require("../models/KPIWeight.model");
const { KPIScore } = require("../models/KPIScore.model");
const { User } = require("../models/User.model");
const { Department } = require("../models/Department.model");
const { Task } = require("../models/Task.model");
const mongoose = require("mongoose");

// ============================================================
// CONSTANTS - Define months array at the top
// ============================================================
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

// ============================================================
// KPI WEIGHT MANAGEMENT
// ============================================================

// Get KPI weights for a department
const getKPIWeights = async (req, res) => {
  try {
    const { departmentId } = req.params;

    let weights = await KPIWeight.findOne({ departmentId })
      .populate("departmentId", "name code")
      .populate("createdBy", "fullName email")
      .populate("updatedBy", "fullName email");

    if (!weights) {
      // Return default weights if not configured
      weights = {
        departmentId,
        weights: {
          taskCompletion: 20,
          qualityScore: 20,
          efficiency: 20,
          collaboration: 15,
          innovation: 15,
          attendance: 10,
        },
        totalWeight: 100,
        isActive: true,
      };
    }

    res.json({
      success: true,
      data: weights,
    });
  } catch (error) {
    console.error("Get KPI weights error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Create or update KPI weights for a department
const upsertKPIWeights = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { weights } = req.body;
    const user = req.user;

    // Validate weights
    const {
      taskCompletion,
      qualityScore,
      efficiency,
      collaboration,
      innovation,
      attendance,
    } = weights;

    const total =
      taskCompletion +
      qualityScore +
      efficiency +
      collaboration +
      innovation +
      attendance;

    if (total !== 100) {
      return res.status(400).json({
        success: false,
        message: `Total weight must equal 100%. Current total: ${total}%`,
        total,
      });
    }

    // Check if weights already exist
    let kpiWeights = await KPIWeight.findOne({ departmentId });

    if (kpiWeights) {
      // Update existing
      kpiWeights.weights = {
        taskCompletion,
        qualityScore,
        efficiency,
        collaboration,
        innovation,
        attendance,
      };
      kpiWeights.totalWeight = total;
      kpiWeights.updatedBy = user._id;
      kpiWeights.version += 1;
      await kpiWeights.save();
    } else {
      // Create new
      kpiWeights = await KPIWeight.create({
        departmentId,
        weights: {
          taskCompletion,
          qualityScore,
          efficiency,
          collaboration,
          innovation,
          attendance,
        },
        totalWeight: total,
        createdBy: user._id,
        updatedBy: user._id,
      });
    }

    const populatedWeights = await KPIWeight.findById(kpiWeights._id)
      .populate("departmentId", "name code")
      .populate("createdBy", "fullName email")
      .populate("updatedBy", "fullName email");

    res.json({
      success: true,
      message: "KPI weights saved successfully",
      data: populatedWeights,
    });
  } catch (error) {
    console.error("Upsert KPI weights error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error: " + error.message });
  }
};

// Get all KPI weights (for admin)
const getAllKPIWeights = async (req, res) => {
  try {
    const weights = await KPIWeight.find({ isActive: true })
      .populate("departmentId", "name code")
      .populate("createdBy", "fullName email")
      .populate("updatedBy", "fullName email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: weights,
    });
  } catch (error) {
    console.error("Get all KPI weights error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================================
// KPI CALCULATION
// ============================================================

// Calculate KPI scores for all employees in a department for a specific month
const calculateKPIScores = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { departmentId } = req.params;
    const { month, year } = req.body;
    const user = req.user;

    // Validate inputs
    if (!month || !year) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Month and year are required",
      });
    }

    // Get department
    const department = await Department.findById(departmentId);
    if (!department) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    // Get KPI weights for the department
    let kpiWeights = await KPIWeight.findOne({ departmentId });
    if (!kpiWeights) {
      // Use default weights
      kpiWeights = {
        weights: {
          taskCompletion: 20,
          qualityScore: 20,
          efficiency: 20,
          collaboration: 15,
          innovation: 15,
          attendance: 10,
        },
      };
    }

    // Get all employees in the department
    const employees = await User.find({
      departmentId: departmentId,
      isActive: true,
    }).select("_id fullName email");

    if (employees.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "No employees found in this department",
      });
    }

    // Date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Calculate scores for each employee
    const scores = [];
    for (const employee of employees) {
      // Get tasks for the employee in the month
      const tasks = await Task.find({
        assignedTo: employee._id,
        createdAt: { $gte: startDate, $lte: endDate },
      }).lean();

      // Calculate individual scores
      const employeeScores = await calculateEmployeeScores(
        employee._id,
        tasks,
        kpiWeights.weights,
        departmentId,
        month,
        year,
      );

      // Check if score already exists
      let existingScore = await KPIScore.findOne({
        userId: employee._id,
        month: `${year}-${String(month).padStart(2, "0")}`,
        year: year,
      }).session(session);

      if (existingScore) {
        // Update existing score
        existingScore.scores = employeeScores.scores;
        existingScore.totalScore = employeeScores.totalScore;
        existingScore.performanceLevel = employeeScores.performanceLevel;
        existingScore.calculatedAt = new Date();
        existingScore.calculatedBy = user._id;
        existingScore.comments = employeeScores.comments || "";
        await existingScore.save({ session });
        scores.push(existingScore);
      } else {
        // Create new score
        const newScore = await KPIScore.create(
          [
            {
              userId: employee._id,
              departmentId: departmentId,
              month: `${year}-${String(month).padStart(2, "0")}`,
              year: year,
              scores: employeeScores.scores,
              totalScore: employeeScores.totalScore,
              performanceLevel: employeeScores.performanceLevel,
              calculatedAt: new Date(),
              calculatedBy: user._id,
              comments: employeeScores.comments || "",
            },
          ],
          { session },
        );
        scores.push(newScore[0]);
      }
    }

    // Calculate percentiles and ranks
    await calculatePercentilesAndRanks(departmentId, month, year, session);

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: `KPI scores calculated successfully for ${employees.length} employees`,
      data: {
        totalEmployees: employees.length,
        scoresCreated: scores.length,
        department: department.name,
        month: `${month}/${year}`,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Calculate KPI scores error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// Helper: Calculate individual employee scores
const calculateEmployeeScores = async (
  userId,
  tasks,
  weights,
  departmentId,
  month,
  year,
) => {
  // 1. Task Completion Score
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const taskCompletionScore =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // 2. Quality Score (based on task approval/rejection rate)
  const submittedTasks = tasks.filter(
    (t) => t.status === "submitted" || t.status === "completed",
  );
  const approvedTasks = tasks.filter((t) => t.status === "completed");
  const qualityScore =
    submittedTasks.length > 0
      ? Math.round((approvedTasks.length / submittedTasks.length) * 100)
      : 0;

  // 3. Efficiency Score (based on on-time completion)
  const onTimeTasks = tasks.filter((t) => {
    if (t.status !== "completed") return false;
    return new Date(t.deadline) >= new Date(t.createdAt);
  });
  const efficiencyScore =
    totalTasks > 0 ? Math.round((onTimeTasks.length / totalTasks) * 100) : 0;

  // 4. Collaboration Score (based on team interactions, comments, etc.)
  const tasksWithComments = tasks.filter((t) => t.commentsCount > 0);
  const collaborationScore =
    totalTasks > 0
      ? Math.round((tasksWithComments.length / totalTasks) * 100)
      : 0;

  // 5. Innovation Score (based on new ideas, suggestions, etc.)
  const innovativeTasks = tasks.filter(
    (t) => t.evidenceUrls && t.evidenceUrls.length > 0,
  );
  const innovationScore =
    totalTasks > 0
      ? Math.round((innovativeTasks.length / totalTasks) * 100)
      : 0;

  // 6. Attendance Score (based on workdays)
  const attendanceScore = 100; // Placeholder - should be calculated from attendance system

  // Calculate weighted scores
  const weightedScores = {
    taskCompletion: {
      score: taskCompletionScore,
      weight: weights.taskCompletion,
      weightedScore: Math.round(
        (taskCompletionScore * weights.taskCompletion) / 100,
      ),
    },
    qualityScore: {
      score: qualityScore,
      weight: weights.qualityScore,
      weightedScore: Math.round((qualityScore * weights.qualityScore) / 100),
    },
    efficiency: {
      score: efficiencyScore,
      weight: weights.efficiency,
      weightedScore: Math.round((efficiencyScore * weights.efficiency) / 100),
    },
    collaboration: {
      score: collaborationScore,
      weight: weights.collaboration,
      weightedScore: Math.round(
        (collaborationScore * weights.collaboration) / 100,
      ),
    },
    innovation: {
      score: innovationScore,
      weight: weights.innovation,
      weightedScore: Math.round((innovationScore * weights.innovation) / 100),
    },
    attendance: {
      score: attendanceScore,
      weight: weights.attendance,
      weightedScore: Math.round((attendanceScore * weights.attendance) / 100),
    },
  };

  const totalScore = Math.round(
    weightedScores.taskCompletion.weightedScore +
      weightedScores.qualityScore.weightedScore +
      weightedScores.efficiency.weightedScore +
      weightedScores.collaboration.weightedScore +
      weightedScores.innovation.weightedScore +
      weightedScores.attendance.weightedScore,
  );

  // Performance level
  let performanceLevel = "average";
  if (totalScore >= 90) performanceLevel = "excellent";
  else if (totalScore >= 75) performanceLevel = "good";
  else if (totalScore >= 60) performanceLevel = "average";
  else performanceLevel = "needs_improvement";

  return {
    scores: weightedScores,
    totalScore,
    performanceLevel,
    comments: `Calculated for ${month}/${year}`,
  };
};

// Helper: Calculate percentiles and ranks
const calculatePercentilesAndRanks = async (
  departmentId,
  month,
  year,
  session,
) => {
  // Get all scores for the department and month
  const allScores = await KPIScore.find({
    departmentId: departmentId,
    month: `${year}-${String(month).padStart(2, "0")}`,
    year: year,
  })
    .sort({ totalScore: -1 })
    .session(session);

  const total = allScores.length;

  for (let i = 0; i < allScores.length; i++) {
    const score = allScores[i];
    const rank = i + 1;
    const percentile = total > 0 ? Math.round(((total - i) / total) * 100) : 0;

    await KPIScore.findByIdAndUpdate(
      score._id,
      {
        rank: rank,
        percentile: percentile,
        totalEmployees: total,
      },
      { session },
    );
  }
};

// ============================================================
// KPI SCORE RETRIEVAL
// ============================================================

// Get KPI scores for an employee
const getEmployeeKPIScores = async (req, res) => {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;

    const query = { userId };
    if (month && year) {
      query.month = `${year}-${String(month).padStart(2, "0")}`;
      query.year = parseInt(year);
    }

    const scores = await KPIScore.find(query)
      .populate("userId", "fullName email employeeId")
      .populate("departmentId", "name code")
      .sort({ year: -1, month: -1 });

    res.json({
      success: true,
      data: scores,
    });
  } catch (error) {
    console.error("Get employee KPI scores error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get KPI scores for a department (for a specific month)
const getDepartmentKPIScores = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: "Month and year are required",
      });
    }

    const scores = await KPIScore.find({
      departmentId: departmentId,
      month: `${year}-${String(month).padStart(2, "0")}`,
      year: parseInt(year),
    })
      .populate("userId", "fullName email employeeId")
      .sort({ totalScore: -1 });

    // Calculate department average
    const averageScore =
      scores.length > 0
        ? Math.round(
            scores.reduce((sum, s) => sum + s.totalScore, 0) / scores.length,
          )
        : 0;

    // Distribution
    const distribution = {
      excellent: scores.filter((s) => s.performanceLevel === "excellent")
        .length,
      good: scores.filter((s) => s.performanceLevel === "good").length,
      average: scores.filter((s) => s.performanceLevel === "average").length,
      needs_improvement: scores.filter(
        (s) => s.performanceLevel === "needs_improvement",
      ).length,
    };

    res.json({
      success: true,
      data: {
        scores,
        summary: {
          totalEmployees: scores.length,
          averageScore,
          distribution,
        },
      },
    });
  } catch (error) {
    console.error("Get department KPI scores error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================================
// GET MONTHLY KPI REPORT - FIXED with MONTHS constant
// ============================================================
const getMonthlyKPIReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    const user = req.user;

    console.log("📊 Fetching KPI report for:", { month, year });

    // Validate required parameters
    if (!month || !year) {
      // If no month/year provided, use current month
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      
      console.log(`📊 Using current month: ${currentMonth}/${currentYear}`);
      
      // Use current month/year
      const monthIndex = currentMonth;
      const yearNum = currentYear;
      
      // Get all KPI scores for the current month
      const startDate = new Date(yearNum, monthIndex - 1, 1);
      const endDate = new Date(yearNum, monthIndex, 0, 23, 59, 59, 999);
      
      const kpiScores = await KPIScore.find({
        userId: { $ne: null },
        calculatedAt: { $gte: startDate, $lte: endDate },
      })
        .populate("userId", "fullName email employeeId role")
        .populate("departmentId", "name code")
        .sort({ totalScore: -1 })
        .lean();

      // Calculate distribution
      const distribution = {
        excellent: 0,
        good: 0,
        average: 0,
        needs_improvement: 0,
      };
      
      kpiScores.forEach((score) => {
        if (score.performanceLevel === "excellent") distribution.excellent++;
        else if (score.performanceLevel === "good") distribution.good++;
        else if (score.performanceLevel === "average") distribution.average++;
        else if (score.performanceLevel === "needs_improvement") distribution.needs_improvement++;
      });

      return res.json({
        success: true,
        data: {
          allScores: kpiScores,
          distribution,
          total: kpiScores.length,
          month: MONTHS[monthIndex - 1], // FIXED: Use MONTHS constant
          year: yearNum,
        },
      });
    }

    const monthIndex = parseInt(month);
    const yearNum = parseInt(year);

    if (isNaN(monthIndex) || isNaN(yearNum) || monthIndex < 1 || monthIndex > 12) {
      return res.status(400).json({
        success: false,
        message: "Invalid month or year. Month must be 1-12 and year must be a valid number.",
      });
    }

    // Get all KPI scores for the specified month
    const startDate = new Date(yearNum, monthIndex - 1, 1);
    const endDate = new Date(yearNum, monthIndex, 0, 23, 59, 59, 999);
    
    const kpiScores = await KPIScore.find({
      userId: { $ne: null },
      calculatedAt: { $gte: startDate, $lte: endDate },
    })
      .populate("userId", "fullName email employeeId role")
      .populate("departmentId", "name code")
      .sort({ totalScore: -1 })
      .lean();

    // Calculate distribution
    const distribution = {
      excellent: 0,
      good: 0,
      average: 0,
      needs_improvement: 0,
    };
    
    kpiScores.forEach((score) => {
      if (score.performanceLevel === "excellent") distribution.excellent++;
      else if (score.performanceLevel === "good") distribution.good++;
      else if (score.performanceLevel === "average") distribution.average++;
      else if (score.performanceLevel === "needs_improvement") distribution.needs_improvement++;
    });

    res.json({
      success: true,
      data: {
        allScores: kpiScores,
        distribution,
        total: kpiScores.length,
        month: MONTHS[monthIndex - 1], // FIXED: Use MONTHS constant
        year: yearNum,
      },
    });
  } catch (error) {
    console.error("Get monthly KPI report error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// Get KPI trend for an employee
const getKPITrend = async (req, res) => {
  try {
    const { userId } = req.params;
    const { months = 6 } = req.query;

    const scores = await KPIScore.find({ userId })
      .sort({ year: -1, month: -1 })
      .limit(parseInt(months))
      .lean();

    // Format trend data
    const trend = scores
      .map((score) => ({
        month: score.month,
        totalScore: score.totalScore,
        performanceLevel: score.performanceLevel,
        components: {
          taskCompletion: score.scores.taskCompletion.score,
          qualityScore: score.scores.qualityScore.score,
          efficiency: score.scores.efficiency.score,
          collaboration: score.scores.collaboration.score,
          innovation: score.scores.innovation.score,
          attendance: score.scores.attendance.score,
        },
      }))
      .reverse();

    res.json({
      success: true,
      data: trend,
    });
  } catch (error) {
    console.error("Get KPI trend error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================================
// EXPORT
// ============================================================
module.exports = {
  getKPIWeights,
  upsertKPIWeights,
  getAllKPIWeights,
  calculateKPIScores,
  getEmployeeKPIScores,
  getDepartmentKPIScores,
  getMonthlyKPIReport,
  getKPITrend,
};