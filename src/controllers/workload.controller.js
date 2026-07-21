// src/controllers/workload.controller.js

const { User } = require("../models/User.model");
const { Task } = require("../models/Task.model");

// Get workload capacity for all users
const getWorkloadCapacity = async (req, res) => {
  try {
    // Get all active users with their department populated
    const users = await User.find({ isActive: true })
      .populate('department', 'name code') // Using 'department' (not 'departmentId')
      .populate('roles', 'name code level')
      .select('-password');

    // Get active tasks grouped by assignedTo
    const taskCounts = await Task.aggregate([
      {
        $match: {
          status: { $in: ['pending', 'in_progress', 'assigned', 'todo', 'in_progress'] },
          assignedTo: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$assignedTo',
          taskCount: { $sum: 1 }
        }
      }
    ]);

    // Create task count map
    const taskCountMap = {};
    taskCounts.forEach(item => {
      taskCountMap[item._id?.toString()] = item.taskCount;
    });

    // Calculate workload for each user
    const workloadData = users.map(user => {
      const taskCount = taskCountMap[user._id?.toString()] || 0;
      
      // Get role level based on primary role
      const roleLevelMap = {
        super_admin: 100,
        admin: 90,
        hr_manager: 80,
        dept_manager: 70,
        project_manager: 65,
        line_manager: 60,
        employee: 50,
      };
      
      // Check if user has roles array with populated data
      let roleLevel = 50; // default
      if (user.roles && user.roles.length > 0) {
        // Find highest role level from roles array
        const maxLevel = Math.max(...user.roles.map(r => roleLevelMap[r.code?.toLowerCase()] || 0));
        roleLevel = maxLevel || 50;
      } else if (user.role) {
        roleLevel = roleLevelMap[user.role] || 50;
      }
      
      // Calculate workload
      const estimatedHoursPerTask = 8;
      const activeHours = taskCount * estimatedHoursPerTask;
      const monthlyCapacity = roleLevel * 0.8; // 80% of role level as capacity
      const capacityPercentage = monthlyCapacity > 0 
        ? Math.min(Math.round((activeHours / monthlyCapacity) * 100), 150)
        : 0;

      // Determine status color
      const statusColor = capacityPercentage > 90 ? 'red' 
        : capacityPercentage > 70 ? 'amber' 
        : 'green';

      // Return user with workload info
      return {
        user: {
          _id: user._id,
          fullName: user.fullName || 'No Name',
          email: user.email || 'No Email',
          role: user.role || 'employee',
          department: user.department || null, // This will be populated
        },
        workload: {
          capacityPercentage,
          statusColor,
          activeHours,
          taskCount,
          monthlyCapacity: Math.round(monthlyCapacity),
        }
      };
    });

    // Sort by capacity percentage (highest first)
    workloadData.sort((a, b) => b.workload.capacityPercentage - a.workload.capacityPercentage);

    res.json({
      success: true,
      data: workloadData,
      count: workloadData.length,
    });
  } catch (error) {
    console.error('Get workload capacity error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message,
    });
  }
};

// Get workload for a specific user
const getUserWorkload = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .populate('department', 'name code')
      .populate('roles', 'name code level')
      .select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get task counts for this user
    const taskCount = await Task.countDocuments({
      assignedTo: userId,
      status: { $in: ['pending', 'in_progress', 'assigned', 'todo', 'in_progress'] }
    });

    // Calculate workload based on role
    const roleLevelMap = {
      super_admin: 100,
      admin: 90,
      hr_manager: 80,
      dept_manager: 70,
      project_manager: 65,
      line_manager: 60,
      employee: 50,
    };
    
    let roleLevel = 50;
    if (user.roles && user.roles.length > 0) {
      const maxLevel = Math.max(...user.roles.map(r => roleLevelMap[r.code?.toLowerCase()] || 0));
      roleLevel = maxLevel || 50;
    } else if (user.role) {
      roleLevel = roleLevelMap[user.role] || 50;
    }

    const estimatedHoursPerTask = 8;
    const activeHours = taskCount * estimatedHoursPerTask;
    const monthlyCapacity = roleLevel * 0.8;
    const capacityPercentage = monthlyCapacity > 0 
      ? Math.min(Math.round((activeHours / monthlyCapacity) * 100), 150)
      : 0;

    const statusColor = capacityPercentage > 90 ? 'red' 
      : capacityPercentage > 70 ? 'amber' 
      : 'green';

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          department: user.department,
        },
        workload: {
          capacityPercentage,
          statusColor,
          activeHours,
          taskCount,
          monthlyCapacity: Math.round(monthlyCapacity),
          roleLevel,
        }
      }
    });
  } catch (error) {
    console.error('Get user workload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message,
    });
  }
};

// Get workload summary for dashboard
const getWorkloadSummary = async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .populate('department', 'name code')
      .select('_id fullName email role department');

    // Get task counts
    const taskCounts = await Task.aggregate([
      {
        $match: {
          status: { $in: ['pending', 'in_progress', 'assigned', 'todo', 'in_progress'] },
          assignedTo: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$assignedTo',
          count: { $sum: 1 }
        }
      }
    ]);

    const taskMap = {};
    taskCounts.forEach(item => {
      taskMap[item._id.toString()] = item.count;
    });

    let totalActiveHours = 0;
    let totalCapacity = 0;
    let overloadedCount = 0;
    let nearCapacityCount = 0;

    const userWorkloads = users.map(user => {
      const taskCount = taskMap[user._id.toString()] || 0;
      
      const roleLevelMap = {
        super_admin: 100,
        admin: 90,
        hr_manager: 80,
        dept_manager: 70,
        project_manager: 65,
        line_manager: 60,
        employee: 50,
      };
      
      const roleLevel = roleLevelMap[user.role] || 50;
      const activeHours = taskCount * 8;
      const monthlyCapacity = roleLevel * 0.8;
      const capacityPercentage = monthlyCapacity > 0 
        ? Math.min(Math.round((activeHours / monthlyCapacity) * 100), 150)
        : 0;

      totalActiveHours += activeHours;
      totalCapacity += monthlyCapacity;

      if (capacityPercentage > 90) overloadedCount++;
      else if (capacityPercentage > 70) nearCapacityCount++;

      return {
        userId: user._id,
        fullName: user.fullName,
        department: user.department?.name || 'No Department',
        taskCount,
        capacityPercentage,
        statusColor: capacityPercentage > 90 ? 'red' : capacityPercentage > 70 ? 'amber' : 'green',
      };
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalUsers: users.length,
          totalActiveTasks: Object.values(taskMap).reduce((a, b) => a + b, 0),
          totalActiveHours,
          totalCapacity: Math.round(totalCapacity),
          averageCapacity: users.length > 0 ? Math.round((totalActiveHours / totalCapacity) * 100) : 0,
          overloadedCount,
          nearCapacityCount,
          healthyCount: users.length - overloadedCount - nearCapacityCount,
        },
        users: userWorkloads,
      }
    });
  } catch (error) {
    console.error('Get workload summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message,
    });
  }
};

module.exports = {
  getWorkloadCapacity,
  getUserWorkload,
  getWorkloadSummary,
};