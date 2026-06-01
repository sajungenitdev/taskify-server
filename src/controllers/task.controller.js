const { Task } = require("../models/Task.model");
const { User } = require("../models/User.model");

// Get tasks based on user role
const getTasks = async (req, res) => {
  try {
    const user = req.user;
    const { status, priority, page = 1, limit = 20 } = req.query;

    let query = {};

    // Role-based filtering
    if (user.role === "employee") {
      query.assignedTo = user._id;
    } else if (user.role === "line_manager") {
      const teamMembers = await User.find({ managerId: user._id }).select(
        "_id",
      );
      query.assignedTo = { $in: [...teamMembers.map((m) => m._id), user._id] };
    } else if (
      user.role === "dept_manager" ||
      user.role === "project_manager"
    ) {
      query.departmentId = user.departmentId;
    }
    // Admin, Super Admin, HR can see all tasks

    if (status) query.status = status;
    if (priority) query.priority = priority;

    const tasks = await Task.find(query)
      .populate("assignedTo", "fullName email employeeId")
      .populate("assignedBy", "fullName email")
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await Task.countDocuments(query);

    // Calculate stats
    const stats = {
      total: await Task.countDocuments(query),
      pending: await Task.countDocuments({ ...query, status: "pending" }),
      inProgress: await Task.countDocuments({
        ...query,
        status: "in_progress",
      }),
      completed: await Task.countDocuments({ ...query, status: "completed" }),
      overdue: await Task.countDocuments({ ...query, status: "overdue" }),
    };

    res.json({
      success: true,
      data: tasks,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get tasks error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get my tasks (for employee)
const getMyTasks = async (req, res) => {
  try {
    const user = req.user;
    const { status } = req.query;

    const query = { assignedTo: user._id };
    if (status) query.status = status;

    const tasks = await Task.find(query)
      .populate("assignedBy", "fullName email")
      .sort({ deadline: 1 });

    const stats = {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "pending").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      overdue: tasks.filter((t) => t.status === "overdue").length,
    };

    res.json({
      success: true,
      data: tasks,
      stats,
    });
  } catch (error) {
    console.error("Get my tasks error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get single task
const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findById(id)
      .populate("assignedTo", "fullName email employeeId")
      .populate("assignedBy", "fullName email");

    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    res.json({ success: true, data: task });
  } catch (error) {
    console.error("Get task error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Create task
const createTask = async (req, res) => {
  try {
    const user = req.user;
    const {
      title,
      description,
      project,
      assignedTo,
      deadline,
      priority,
      estimatedHours,
      departmentId,
      isApprovalRequired,
      evidenceRequired,
    } = req.body;

    // Validate required fields
    if (!title || !description || !assignedTo || !deadline) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: title, description, assignedTo, deadline",
      });
    }

    // Get the assigned user to get their department
    const assignedUser = await User.findById(assignedTo);
    if (!assignedUser) {
      return res
        .status(404)
        .json({ success: false, message: "Assigned user not found" });
    }

    const task = await Task.create({
      title,
      description,
      project: project || "",
      assignedTo,
      assignedBy: user._id,
      departmentId: departmentId || assignedUser.departmentId,
      priority: priority || "normal",
      status: "pending",
      estimatedHours: estimatedHours || 0,
      deadline,
      isApprovalRequired: isApprovalRequired || false,
      evidenceRequired: evidenceRequired || false,
    });

    const populatedTask = await Task.findById(task._id)
      .populate("assignedTo", "fullName email")
      .populate("assignedBy", "fullName email");

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: populatedTask,
    });
  } catch (error) {
    console.error("Create task error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error: " + error.message });
  }
};

// Update task
const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const task = await Task.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    })
      .populate("assignedTo", "fullName email")
      .populate("assignedBy", "fullName email");

    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    res.json({
      success: true,
      message: "Task updated successfully",
      data: task,
    });
  } catch (error) {
    console.error("Update task error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update task status
const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = [
      "pending",
      "in_progress",
      "submitted",
      "completed",
      "overdue",
      "rejected",
    ];
    if (!validStatuses.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    const task = await Task.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    ).populate("assignedTo", "fullName email");

    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    res.json({
      success: true,
      message: `Task status updated to ${status}`,
      data: task,
    });
  } catch (error) {
    console.error("Update status error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Request extension
const requestExtension = async (req, res) => {
  try {
    const { id } = req.params;
    const { requestedDate, reason } = req.body;

    const task = await Task.findByIdAndUpdate(
      id,
      {
        $push: {
          extensionRequests: {
            requestedDate: new Date(requestedDate),
            reason,
            status: "pending",
          },
        },
      },
      { new: true },
    );

    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    res.json({
      success: true,
      message: "Extension request submitted",
      data: task,
    });
  } catch (error) {
    console.error("Extension request error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Approve extension
const approveExtension = async (req, res) => {
  try {
    const { id, extensionId } = req.params;

    const task = await Task.findOneAndUpdate(
      { _id: id, "extensionRequests._id": extensionId },
      {
        $set: {
          "extensionRequests.$.status": "approved",
          "extensionRequests.$.approvedBy": req.user._id,
          revisedDeadline: new Date(),
        },
      },
      { new: true },
    );

    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task or extension not found" });
    }

    res.json({
      success: true,
      message: "Extension approved",
      data: task,
    });
  } catch (error) {
    console.error("Approve extension error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delete task
const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByIdAndDelete(id);

    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    res.json({ success: true, message: "Task deleted successfully" });
  } catch (error) {
    console.error("Delete task error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getTasks,
  getMyTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  requestExtension,
  approveExtension,
  deleteTask,
};
