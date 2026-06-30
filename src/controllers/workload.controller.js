// controllers/workload.controller.js
const { Task } = require("../models/Task.model");
const { User } = require("../models/User.model");
const { Project } = require("../models/Project.model");
const mongoose = require("mongoose");

// Get team workload capacity
const getTeamWorkload = async (req, res) => {
  try {
    const user = req.user;
    const { departmentId, projectId } = req.query;

    // Determine which team members to show based on user role
    let teamMembers = [];

    if (
      user.role === "admin" ||
      user.role === "super_admin" ||
      user.role === "hr_manager"
    ) {
      // Admins can see all users
      const query = { isActive: true };
      if (departmentId) query.departmentId = departmentId;
      teamMembers = await User.find(query)
        .select(
          "_id fullName email employeeId departmentId role avatar profilePhoto",
        )
        .populate("departmentId", "name");
    } else if (user.role === "dept_manager") {
      // Department managers see their department
      teamMembers = await User.find({
        departmentId: user.departmentId,
        isActive: true,
      })
        .select("_id fullName email employeeId departmentId role avatar")
        .populate("departmentId", "name");
    } else if (user.role === "project_manager") {
      // Project managers see team members in their projects
      const projects = await Project.find({
        projectManager: user._id,
      }).select("_id teamMembers");

      const teamMemberIds = projects.flatMap(
        (p) => p.teamMembers?.map((m) => m.userId) || [],
      );

      // Add the project manager themselves
      teamMemberIds.push(user._id);

      teamMembers = await User.find({
        _id: { $in: teamMemberIds },
        isActive: true,
      })
        .select("_id fullName email employeeId departmentId role avatar")
        .populate("departmentId", "name");
    } else if (user.role === "line_manager") {
      // Line managers see their direct reports
      teamMembers = await User.find({
        managerId: user._id,
        isActive: true,
      })
        .select("_id fullName email employeeId departmentId role avatar")
        .populate("departmentId", "name");

      // Add the line manager themselves
      teamMembers.push(user);
    } else {
      // Regular employees only see themselves
      teamMembers = [user];
    }

    // If no team members found, return empty array
    if (!teamMembers || teamMembers.length === 0) {
      return res.json({
        success: true,
        data: [],
        aggregates: {
          totalMembers: 0,
          totalActiveHours: 0,
          totalTasks: 0,
          averageUtilization: 0,
          utilizationDistribution: { green: 0, amber: 0, red: 0 },
        },
        filters: {
          departmentId: departmentId || null,
          projectId: projectId || null,
        },
        period: {
          start: new Date(),
          end: new Date(),
        },
      });
    }

    // Get current date and date range (current month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Calculate workload for each team member
    const workloadData = await Promise.all(
      teamMembers.map(async (member) => {
        // Get all tasks for this member with statuses
        const tasks = await Task.find({
          assignedTo: member._id,
          status: { $in: ["pending", "in_progress", "submitted"] },
        })
          .populate("projectId", "name code")
          .select("title estimatedHours status deadline priority projectId");

        // Get completed tasks for this month
        const completedTasks = await Task.find({
          assignedTo: member._id,
          status: "completed",
          updatedAt: { $gte: startOfMonth, $lte: endOfMonth },
        });

        // Calculate active workload hours
        let activeWorkload = 0;
        let taskCount = tasks.length;

        tasks.forEach((task) => {
          activeWorkload += task.estimatedHours || 0;
        });

        // Calculate completed hours this month
        let completedHours = 0;
        completedTasks.forEach((task) => {
          completedHours += task.actualMinutes ? task.actualMinutes / 60 : 0;
        });

        // Get task breakdown by status
        const taskBreakdown = {
          pending: tasks.filter((t) => t.status === "pending").length,
          inProgress: tasks.filter((t) => t.status === "in_progress").length,
          submitted: tasks.filter((t) => t.status === "submitted").length,
        };

        // Get priority distribution
        const priorityDistribution = {
          low: tasks.filter((t) => t.priority === "low").length,
          normal: tasks.filter((t) => t.priority === "normal").length,
          high: tasks.filter((t) => t.priority === "high").length,
          urgent: tasks.filter((t) => t.priority === "urgent").length,
        };

        // Get upcoming deadlines (next 7 days)
        const upcomingDeadlines = tasks
          .filter((t) => {
            const deadline = new Date(t.deadline);
            const diffDays = Math.ceil(
              (deadline - now) / (1000 * 60 * 60 * 24),
            );
            return diffDays >= 0 && diffDays <= 7;
          })
          .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
          .slice(0, 5);

        // Calculate capacity percentage (assuming 40 hours/week = 160 hours/month)
        const monthlyCapacity = 160; // Standard 40-hour work week
        const capacityPercentage = Math.min(
          Math.round((activeWorkload / monthlyCapacity) * 100),
          200, // Cap at 200% for display
        );

        // Determine color based on capacity
        let statusColor = "green";
        if (capacityPercentage > 100) statusColor = "red";
        else if (capacityPercentage > 80) statusColor = "amber";

        // Get department name safely
        let departmentName = "Unassigned";
        if (member.departmentId) {
          if (
            typeof member.departmentId === "object" &&
            member.departmentId.name
          ) {
            departmentName = member.departmentId.name;
          } else if (typeof member.departmentId === "string") {
            departmentName = member.departmentId;
          }
        }

        return {
          user: {
            _id: member._id,
            fullName: member.fullName,
            email: member.email,
            employeeId: member.employeeId,
            department: departmentName,
            role: member.role,
            avatar: member.avatar || member.profilePhoto || null,
            profilePhoto: member.profilePhoto || null,
          },
          workload: {
            activeHours: Math.round(activeWorkload * 10) / 10,
            completedHours: Math.round(completedHours * 10) / 10,
            taskCount,
            completedTaskCount: completedTasks.length,
            capacityPercentage,
            statusColor,
            monthlyCapacity,
          },
          breakdown: {
            taskBreakdown,
            priorityDistribution,
            upcomingDeadlines: upcomingDeadlines.map((t) => ({
              _id: t._id,
              title: t.title,
              deadline: t.deadline,
              estimatedHours: t.estimatedHours,
              priority: t.priority,
              project: t.projectId?.name || "No Project",
            })),
          },
          projects: [...new Set(tasks.map((t) => t.projectId?._id?.toString()))]
            .length,
        };
      }),
    );

    // Calculate team aggregates
    const teamAggregates = {
      totalMembers: workloadData.length,
      totalActiveHours:
        Math.round(
          workloadData.reduce((sum, d) => sum + d.workload.activeHours, 0) * 10,
        ) / 10,
      totalTasks: workloadData.reduce(
        (sum, d) => sum + d.workload.taskCount,
        0,
      ),
      averageUtilization: Math.round(
        workloadData.reduce(
          (sum, d) => sum + d.workload.capacityPercentage,
          0,
        ) / (workloadData.length || 1),
      ),
      utilizationDistribution: {
        green: workloadData.filter((d) => d.workload.statusColor === "green")
          .length,
        amber: workloadData.filter((d) => d.workload.statusColor === "amber")
          .length,
        red: workloadData.filter((d) => d.workload.statusColor === "red")
          .length,
      },
    };

    res.json({
      success: true,
      data: workloadData,
      aggregates: teamAggregates,
      filters: {
        departmentId: departmentId || null,
        projectId: projectId || null,
      },
      period: {
        start: startOfMonth,
        end: endOfMonth,
      },
    });
  } catch (error) {
    console.error("Get team workload error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// Get individual workload details
const getIndividualWorkload = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = req.user;

    // Check if user ID is valid
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    // Check if user has permission to view this person's workload
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Permission check
    const canView =
      user._id.toString() === userId ||
      user.role === "admin" ||
      user.role === "super_admin" ||
      user.role === "hr_manager" ||
      (user.role === "dept_manager" &&
        user.departmentId?.toString() ===
          targetUser.departmentId?.toString()) ||
      (user.role === "line_manager" &&
        targetUser.managerId?.toString() === user._id.toString());

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to view this user's workload",
      });
    }

    // Get all tasks for this user
    const tasks = await Task.find({
      assignedTo: userId,
      status: { $in: ["pending", "in_progress", "submitted", "completed"] },
    })
      .populate("projectId", "name code description")
      .populate("assignedBy", "fullName email")
      .sort({ createdAt: -1 });

    // Separate active and completed tasks
    const activeTasks = tasks.filter((t) =>
      ["pending", "in_progress", "submitted"].includes(t.status),
    );
    const completedTasks = tasks.filter((t) => t.status === "completed");

    // Calculate detailed metrics
    const metrics = {
      totalTasks: tasks.length,
      activeTasks: activeTasks.length,
      completedTasks: completedTasks.length,
      totalEstimatedHours:
        Math.round(
          activeTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0) * 10,
        ) / 10,
      totalActualHours:
        Math.round(
          tasks.reduce((sum, t) => sum + (t.actualMinutes || 0) / 60, 0) * 10,
        ) / 10,
      completionRate:
        tasks.length > 0
          ? Math.round((completedTasks.length / tasks.length) * 100)
          : 0,
    };

    // Tasks by project
    const tasksByProject = tasks.reduce((acc, task) => {
      const projectId = task.projectId?._id?.toString() || "unassigned";
      if (!acc[projectId]) {
        acc[projectId] = {
          project: task.projectId || { name: "Unassigned" },
          tasks: [],
          totalEstimated: 0,
        };
      }
      acc[projectId].tasks.push(task);
      acc[projectId].totalEstimated += task.estimatedHours || 0;
      return acc;
    }, {});

    // Weekly breakdown (last 4 weeks)
    const weeklyBreakdown = [];
    const today = new Date();
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (today.getDay() + 7 * i) + 1);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const weekTasks = tasks.filter((t) => {
        const createdAt = new Date(t.createdAt);
        return createdAt >= weekStart && createdAt <= weekEnd;
      });

      weeklyBreakdown.push({
        week: `Week ${4 - i}`,
        start: weekStart.toISOString(),
        end: weekEnd.toISOString(),
        tasks: weekTasks.length,
        completed: weekTasks.filter((t) => t.status === "completed").length,
        hours:
          Math.round(
            weekTasks.reduce((sum, t) => sum + (t.actualMinutes || 0) / 60, 0) *
              10,
          ) / 10,
      });
    }

    // Overdue tasks
    const overdueTasks = activeTasks.filter((t) => {
      const deadline = new Date(t.deadline);
      return deadline < new Date();
    });

    // Format response
    const responseData = {
      user: {
        _id: targetUser._id,
        fullName: targetUser.fullName,
        email: targetUser.email,
        employeeId: targetUser.employeeId,
        department: targetUser.departmentId?.name || "Unassigned",
        role: targetUser.role,
        joinDate: targetUser.createdAt,
      },
      metrics,
      tasksByProject: Object.values(tasksByProject),
      activeTasks: activeTasks.slice(0, 20),
      recentCompleted: completedTasks.slice(0, 10),
      overdueTasks: overdueTasks,
      weeklyBreakdown,
    };

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Get individual workload error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

module.exports = {
  getTeamWorkload,
  getIndividualWorkload,
};
