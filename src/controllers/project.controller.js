// controllers/project.controller.js
const { Project } = require("../models/Project.model");
const { User } = require("../models/User.model");

// ============================================================
// GET ALL PROJECTS
// ============================================================
const getProjects = async (req, res) => {
  try {
    const { status, priority, departmentId, managerId, search } = req.query;
    let query = { isActive: true };

    if (status && status !== "all") query.status = status;
    if (priority) query.priority = priority;
    if (departmentId) query.departmentId = departmentId;
    if (managerId) query.managerId = managerId;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
      ];
    }

    const projects = await Project.find(query)
      .populate("departmentId", "name code")
      .populate("managerId", "fullName email")
      .populate("createdBy", "fullName email")
      .populate("archivedBy", "fullName email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: projects,
      count: projects.length,
    });
  } catch (error) {
    console.error("Get projects error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================================
// GET PROJECT BY ID
// ============================================================
const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id)
      .populate("departmentId", "name code")
      .populate("managerId", "fullName email")
      .populate("createdBy", "fullName email")
      .populate("archivedBy", "fullName email");

    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    res.json({ success: true, data: project });
  } catch (error) {
    console.error("Get project error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================================
// CREATE PROJECT
// ============================================================
const createProject = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      departmentId,
      managerId,
      startDate,
      endDate,
      priority,
      budget,
    } = req.body;

    // Check if project code exists
    const existingProject = await Project.findOne({ code: code.toUpperCase() });
    if (existingProject) {
      return res
        .status(400)
        .json({ success: false, message: "Project code already exists" });
    }

    const project = await Project.create({
      name,
      code: code.toUpperCase(),
      description: description || "",
      departmentId: departmentId || null,
      managerId: managerId || null,
      createdBy: req.user._id,
      startDate,
      endDate,
      priority: priority || "normal",
      status: "active",
      budget: { allocated: budget || 0, spent: 0, currency: "USD" },
      progress: 0,
      tasksCount: 0,
      completedTasks: 0,
      isActive: true,
    });

    const populatedProject = await Project.findById(project._id)
      .populate("departmentId", "name code")
      .populate("managerId", "fullName email")
      .populate("createdBy", "fullName email");

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: populatedProject,
    });
  } catch (error) {
    console.error("Create project error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error: " + error.message });
  }
};

// ============================================================
// UPDATE PROJECT
// ============================================================
const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const project = await Project.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true },
    )
      .populate("departmentId", "name code")
      .populate("managerId", "fullName email")
      .populate("createdBy", "fullName email");

    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    res.json({
      success: true,
      message: "Project updated successfully",
      data: project,
    });
  } catch (error) {
    console.error("Update project error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================================
// DELETE PROJECT (Soft Delete)
// ============================================================
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findByIdAndUpdate(id, { isActive: false });

    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    res.json({ success: true, message: "Project deleted successfully" });
  } catch (error) {
    console.error("Delete project error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================================
// UPDATE PROJECT PROGRESS
// ============================================================
const updateProjectProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { progress, completedTasks, tasksCount } = req.body;

    const project = await Project.findByIdAndUpdate(
      id,
      { progress, completedTasks, tasksCount },
      { new: true },
    );

    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    if (progress === 100 && project.status !== "completed") {
      project.status = "completed";
      project.completedAt = new Date();
      await project.save();
    }

    res.json({
      success: true,
      message: "Project progress updated",
      data: project,
    });
  } catch (error) {
    console.error("Update progress error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================================
// ARCHIVE PROJECT
// ============================================================
const archiveProject = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const project = await Project.findById(id);
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    // Can't archive completed or cancelled projects
    if (project.status === "completed" || project.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Completed or cancelled projects cannot be archived",
      });
    }

    // Check if already archived
    if (project.status === "archived") {
      return res.status(400).json({
        success: false,
        message: "Project is already archived",
      });
    }

    project.status = "archived";
    project.archivedAt = new Date();
    project.archivedBy = user._id;
    await project.save();

    const populatedProject = await Project.findById(project._id)
      .populate("departmentId", "name code")
      .populate("managerId", "fullName email")
      .populate("createdBy", "fullName email")
      .populate("archivedBy", "fullName email");

    res.json({
      success: true,
      message: "Project archived successfully",
      data: populatedProject,
    });
  } catch (error) {
    console.error("Archive project error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================================
// UNARCHIVE PROJECT
// ============================================================
const unarchiveProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findById(id);
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    if (project.status !== "archived") {
      return res.status(400).json({
        success: false,
        message: "Project is not archived",
      });
    }

    project.status = "active";
    project.archivedAt = null;
    project.archivedBy = null;
    await project.save();

    const populatedProject = await Project.findById(project._id)
      .populate("departmentId", "name code")
      .populate("managerId", "fullName email")
      .populate("createdBy", "fullName email");

    res.json({
      success: true,
      message: "Project restored from archive",
      data: populatedProject,
    });
  } catch (error) {
    console.error("Unarchive project error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================================
// GET PROJECT TEMPLATES (Mock Data)
// ============================================================
const getProjectTemplates = async (req, res) => {
  const templates = [
    {
      _id: "1",
      name: "Software Development Project",
      description: "Complete software development lifecycle template",
      category: "Development",
      estimatedDuration: 90,
      taskCount: 25,
      usageCount: 156,
      isFeatured: true,
    },
    {
      _id: "2",
      name: "Marketing Campaign",
      description: "Template for marketing campaigns",
      category: "Marketing",
      estimatedDuration: 30,
      taskCount: 15,
      usageCount: 89,
      isFeatured: true,
    },
    {
      _id: "3",
      name: "Product Launch",
      description: "Complete product launch template",
      category: "Product",
      estimatedDuration: 45,
      taskCount: 32,
      usageCount: 67,
      isFeatured: false,
    },
  ];

  res.json({ success: true, data: templates });
};

// ============================================================
// GET PROJECT RESOURCES (Mock Data)
// ============================================================
const getProjectResources = async (req, res) => {
  const resources = [
    {
      _id: "1",
      name: "John Smith",
      type: "human",
      assignedTo: { _id: "1", fullName: "John Smith" },
      projectId: { _id: "1", name: "Website Redesign" },
      startDate: "2024-01-01",
      endDate: "2024-06-30",
      status: "in_use",
      utilization: 85,
    },
    {
      _id: "2",
      name: "AWS Server",
      type: "equipment",
      assignedTo: null,
      projectId: { _id: "2", name: "Cloud Migration" },
      startDate: "2024-02-01",
      endDate: "2024-12-31",
      status: "in_use",
      utilization: 60,
    },
  ];

  res.json({ success: true, data: resources });
};

// ============================================================
// PROJECT DASHBOARD - BURNDOWN CHART
// ============================================================
const getProjectBurndown = async (req, res) => {
  try {
    const { id } = req.params;
    const { range = "month" } = req.query;

    const project = await Project.findById(id);
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    // Get all tasks for this project - try to import Task dynamically
    let tasks = [];
    try {
      const { Task } = require("../models/Task.model");
      tasks = await Task.find({ projectId: id })
        .select("createdAt status deadline")
        .sort({ createdAt: 1 })
        .lean();
    } catch (error) {
      console.warn("Task model not found, using empty tasks array");
    }

    // Calculate date range
    const startDate = new Date(project.startDate);
    const endDate = new Date(project.endDate);
    const now = new Date();

    // Determine range
    let rangeStart = startDate;
    if (range === "week") {
      rangeStart = new Date(now);
      rangeStart.setDate(rangeStart.getDate() - 7);
    } else if (range === "month") {
      rangeStart = new Date(now);
      rangeStart.setMonth(rangeStart.getMonth() - 1);
    }

    // Generate dates for the range
    const dates = [];
    let currentDate = new Date(rangeStart);
    const endRange = range === "all" ? endDate : now;

    while (currentDate <= endRange) {
      dates.push({
        date: new Date(currentDate),
        dateStr: currentDate.toISOString().split("T")[0],
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // If no dates or no tasks, return empty data
    if (dates.length === 0 || tasks.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    // Calculate total tasks
    const totalTasks = tasks.length;

    // Build burndown data
    const burndownData = dates.map(({ date, dateStr }, index) => {
      // Tasks completed up to this date
      const completedTasks = tasks.filter(
        (t) => t.status === "completed" && new Date(t.createdAt) <= date,
      ).length;

      // Tasks created up to this date
      const createdTasks = tasks.filter(
        (t) => new Date(t.createdAt) <= date,
      ).length;

      const remaining = Math.max(0, createdTasks - completedTasks);
      const idealRemaining = Math.max(
        0,
        totalTasks - (totalTasks / dates.length) * (index + 1),
      );

      return {
        date: dateStr,
        idealRemaining: Math.round(idealRemaining),
        actualRemaining: remaining,
        completed: completedTasks,
        total: totalTasks,
      };
    });

    res.json({
      success: true,
      data: burndownData,
    });
  } catch (error) {
    console.error("Get burndown error:", error);
    res.json({
      success: true,
      data: [],
    });
  }
};

// ============================================================
// PROJECT DASHBOARD - TASK STATISTICS
// ============================================================
const getProjectTaskStats = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findById(id);
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    let tasks = [];
    try {
      const { Task } = require("../models/Task.model");
      tasks = await Task.find({ projectId: id })
        .populate("assignedTo", "fullName email")
        .lean();
    } catch (error) {
      console.warn("Task model not found, using empty tasks array");
    }

    // Calculate stats
    const stats = {
      total: tasks.length,
      completed: tasks.filter((t) => t.status === "completed").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      pending: tasks.filter((t) => t.status === "pending").length,
      submitted: tasks.filter((t) => t.status === "submitted").length,
      overdue: tasks.filter((t) => t.status === "overdue").length,
      rejected: tasks.filter((t) => t.status === "rejected").length,
      byPriority: {
        low: tasks.filter((t) => t.priority === "low").length,
        normal: tasks.filter((t) => t.priority === "normal").length,
        high: tasks.filter((t) => t.priority === "high").length,
        urgent: tasks.filter((t) => t.priority === "urgent").length,
      },
      byAssignee: [],
    };

    // Group by assignee
    const assigneeMap = new Map();
    tasks.forEach((task) => {
      if (task.assignedTo) {
        const key = task.assignedTo._id.toString();
        if (!assigneeMap.has(key)) {
          assigneeMap.set(key, {
            userId: key,
            fullName: task.assignedTo.fullName,
            taskCount: 0,
            completedCount: 0,
            progress: 0,
          });
        }
        const data = assigneeMap.get(key);
        data.taskCount++;
        if (task.status === "completed") {
          data.completedCount++;
        }
      }
    });

    // Calculate progress for each assignee
    assigneeMap.forEach((data) => {
      data.progress =
        data.taskCount > 0
          ? Math.round((data.completedCount / data.taskCount) * 100)
          : 0;
      stats.byAssignee.push(data);
    });

    // Sort by task count descending
    stats.byAssignee.sort((a, b) => b.taskCount - a.taskCount);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Get task stats error:", error);
    res.json({
      success: true,
      data: {
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
        submitted: 0,
        overdue: 0,
        rejected: 0,
        byPriority: { low: 0, normal: 0, high: 0, urgent: 0 },
        byAssignee: [],
      },
    });
  }
};

// ============================================================
// PROJECT DASHBOARD - ACTIVITIES
// ============================================================
const getProjectActivities = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;

    // Get project info for mock data
    const project = await Project.findById(id)
      .select("name createdAt updatedAt")
      .lean();

    // Return mock activities
    const activities = [
      {
        _id: "1",
        action: "created",
        description: `Project "${project?.name || "Unknown"}" was created`,
        userId: {
          _id: "system",
          fullName: "System",
          email: "system@example.com",
        },
        createdAt: project?.createdAt || new Date().toISOString(),
      },
      {
        _id: "2",
        action: "updated",
        description: "Project status is active",
        userId: {
          _id: "system",
          fullName: "System",
          email: "system@example.com",
        },
        createdAt: project?.updatedAt || new Date().toISOString(),
      },
    ];

    res.json({
      success: true,
      data: activities,
    });
  } catch (error) {
    console.error("Get activities error:", error);
    res.json({
      success: true,
      data: [
        {
          _id: "1",
          action: "created",
          description: "Project was created",
          userId: {
            _id: "system",
            fullName: "System",
            email: "system@example.com",
          },
          createdAt: new Date().toISOString(),
        },
      ],
    });
  }
};

// ============================================================
// PROJECT DASHBOARD - TEAM PERFORMANCE
// ============================================================
const getTeamPerformance = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findById(id)
      .populate("teamMembers.userId", "fullName email avatar")
      .lean();

    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    let tasks = [];
    try {
      const { Task } = require("../models/Task.model");
      tasks = await Task.find({ projectId: id })
        .populate("assignedTo", "fullName email")
        .lean();
    } catch (error) {
      console.warn("Task model not found, using empty tasks array");
    }

    // If no team members, return empty array
    if (!project.teamMembers || project.teamMembers.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const performance = project.teamMembers.map((member) => {
      const userId = member.userId._id.toString();
      const userTasks = tasks.filter(
        (t) => t.assignedTo && t.assignedTo._id.toString() === userId,
      );

      const completed = userTasks.filter(
        (t) => t.status === "completed",
      ).length;
      const total = userTasks.length;

      // Calculate average time for completed tasks
      let totalTime = 0;
      let completedTasks = 0;
      userTasks.forEach((task) => {
        if (task.status === "completed" && task.actualMinutes) {
          totalTime += task.actualMinutes / 60; // Convert to hours
          completedTasks++;
        }
      });

      return {
        userId: userId,
        fullName: member.userId.fullName,
        email: member.userId.email,
        avatar: member.userId.avatar,
        role: member.role,
        tasksAssigned: total,
        tasksCompleted: completed,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        averageTime:
          completedTasks > 0
            ? Math.round((totalTime / completedTasks) * 10) / 10
            : 0,
        taskBreakdown: {
          pending: userTasks.filter((t) => t.status === "pending").length,
          inProgress: userTasks.filter((t) => t.status === "in_progress")
            .length,
          submitted: userTasks.filter((t) => t.status === "submitted").length,
          completed: completed,
        },
      };
    });

    // Sort by completion rate descending
    performance.sort((a, b) => b.completionRate - a.completionRate);

    res.json({
      success: true,
      data: performance,
    });
  } catch (error) {
    console.error("Get team performance error:", error);
    res.json({
      success: true,
      data: [],
    });
  }
};

// ============================================================
// EXPORT ALL FUNCTIONS
// ============================================================
module.exports = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  updateProjectProgress,
  getProjectTemplates,
  getProjectResources,
  getProjectBurndown,
  getProjectTaskStats,
  getProjectActivities,
  getTeamPerformance,
  archiveProject,
  unarchiveProject,
};
