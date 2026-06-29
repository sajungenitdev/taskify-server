const { Task } = require("../models/Task.model");
const { User } = require("../models/User.model");
const { Project } = require("../models/Project.model");
const mongoose = require("mongoose");
const { NotificationService } = require("../services/notification.service");
const { createNotification } = require("./notification.controller");

// Get tasks based on user role
const getTasks = async (req, res) => {
  try {
    const user = req.user;
    const { status, priority, projectId, page = 1, limit = 20 } = req.query;

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
    if (projectId) query.projectId = projectId;

    const tasks = await Task.find(query)
      .populate("assignedTo", "fullName email employeeId")
      .populate("assignedBy", "fullName email")
      .populate("projectId", "name code")
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
      submitted: await Task.countDocuments({ ...query, status: "submitted" }),
      completed: await Task.countDocuments({ ...query, status: "completed" }),
      overdue: await Task.countDocuments({ ...query, status: "overdue" }),
      rejected: await Task.countDocuments({ ...query, status: "rejected" }),
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
      .populate("projectId", "name code")
      .sort({ deadline: 1 });

    const stats = {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "pending").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      submitted: tasks.filter((t) => t.status === "submitted").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      overdue: tasks.filter((t) => t.status === "overdue").length,
      rejected: tasks.filter((t) => t.status === "rejected").length,
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
      .populate("assignedBy", "fullName email")
      .populate("projectId", "name code description");

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
      projectId,
      assignedTo,
      deadline,
      priority,
      estimatedHours,
      departmentId,
      isApprovalRequired,
      evidenceRequired,
    } = req.body;

    // Validate required fields
    if (!title || !description || !assignedTo || !deadline || !projectId) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: title, description, assignedTo, deadline, projectId",
      });
    }

    // Get the project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Get the assigned user
    const assignedUser = await User.findById(assignedTo);
    if (!assignedUser) {
      return res.status(404).json({
        success: false,
        message: "Assigned user not found",
      });
    }

    // Get the count of existing tasks in project for ordering
    const taskCount = await Task.countDocuments({ projectId });

    // Check if user is in the project's team (optional validation)
    const isInProjectTeam = project.teamMembers?.some(
      (member) => member.userId.toString() === assignedTo,
    );

    if (
      project.teamMembers &&
      project.teamMembers.length > 0 &&
      !isInProjectTeam
    ) {
      return res.status(400).json({
        success: false,
        message: "Assigned user is not a member of this project",
      });
    }

    const task = await Task.create({
      title,
      description,
      projectId: projectId,
      project: project.name,
      assignedTo,
      assignedBy: user._id,
      departmentId:
        departmentId || assignedUser.departmentId || project.departmentId,
      priority: priority || "normal",
      status: "pending",
      estimatedHours: estimatedHours || 0,
      deadline,
      isApprovalRequired: isApprovalRequired || false,
      evidenceRequired: evidenceRequired || false,
      order: taskCount,
    });

    // Update project task count
    await Project.findByIdAndUpdate(projectId, {
      $inc: { tasksCount: 1 },
    });

    const populatedTask = await Task.findById(task._id)
      .populate("assignedTo", "fullName email employeeId")
      .populate("assignedBy", "fullName email")
      .populate("projectId", "name code");

    // SEND NOTIFICATION - Task Assigned
    await NotificationService.sendTaskAssigned(populatedTask._id);

    res.status(201).json({
      success: true,
      message: "Task created successfully and notification sent",
      data: populatedTask,
    });
  } catch (error) {
    console.error("Create task error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// Update task
const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const user = req.user;

    // Don't allow updating certain fields based on role
    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Role-based update restrictions
    if (user.role === "employee") {
      // Employees can only update status and add evidence
      const allowedUpdates = ["status", "evidenceUrls"];
      const requestedUpdates = Object.keys(updates);
      const isValidUpdate = requestedUpdates.every((update) =>
        allowedUpdates.includes(update),
      );

      if (!isValidUpdate) {
        return res.status(403).json({
          success: false,
          message: "Employees can only update task status and evidence",
        });
      }
    }

    const updatedTask = await Task.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    })
      .populate("assignedTo", "fullName email employeeId")
      .populate("assignedBy", "fullName email")
      .populate("projectId", "name code");

    // If task is completed, update project progress
    if (updates.status === "completed" && task.status !== "completed") {
      await Project.findByIdAndUpdate(task.projectId, {
        $inc: { completedTasks: 1 },
      });
    }

    res.json({
      success: true,
      message: "Task updated successfully",
      data: updatedTask,
    });
  } catch (error) {
    console.error("Update task error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update task status - WITH REJECTION REASON, APPROVAL NOTE, AND EVIDENCE CHECK
const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason, approvalNote, evidenceUrls } = req.body;

    const validStatuses = [
      "pending",
      "in_progress",
      "submitted",
      "completed",
      "overdue",
      "rejected",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    // Get old task before update
    const oldTask = await Task.findById(id)
      .populate("assignedTo", "fullName email")
      .populate("assignedBy", "fullName email")
      .populate("projectId", "name code departmentId");

    if (!oldTask) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }
    const oldStatus = oldTask.status;

    // CHECK: If task requires evidence and user is trying to submit
    if (status === "submitted" && oldTask.evidenceRequired) {
      // Check if evidence URLs exist
      const hasEvidenceUrls = evidenceUrls && evidenceUrls.length > 0;
      const hasExistingEvidence =
        oldTask.evidenceUrls && oldTask.evidenceUrls.length > 0;

      // Also check attachments (if you want to consider attachments as evidence)
      const Attachment = require("../models/Attachment.model");
      const attachments = await Attachment.find({ taskId: id });
      const hasAttachments = attachments && attachments.length > 0;

      if (!hasEvidenceUrls && !hasExistingEvidence && !hasAttachments) {
        return res.status(400).json({
          success: false,
          message:
            "Evidence is required to submit this task. Please upload evidence first.",
          requiresEvidence: true,
        });
      }
    }

    // Build update object
    const updateData = { status };

    // Store rejection reason if provided
    if (status === "rejected" && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    // Store approval note if provided
    if (status === "completed" && approvalNote) {
      updateData.approvalNote = approvalNote;
    }

    // Store evidence URLs if provided
    if (evidenceUrls && evidenceUrls.length > 0) {
      // Merge with existing evidence URLs
      const existingUrls = oldTask.evidenceUrls || [];
      const allUrls = [...new Set([...existingUrls, ...evidenceUrls])];
      updateData.evidenceUrls = allUrls;
      updateData.evidenceSubmitted = true;
      updateData.evidenceSubmittedAt = new Date();
    }

    // If submitting, mark evidence as submitted
    if (status === "submitted") {
      updateData.evidenceSubmitted = true;
      updateData.evidenceSubmittedAt = new Date();
    }

    // Update task
    const task = await Task.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: false },
    )
      .populate("assignedTo", "fullName email")
      .populate("assignedBy", "fullName email")
      .populate("projectId", "name code");

    // Update project progress
    if (status === "completed" && oldStatus !== "completed") {
      await Project.findByIdAndUpdate(task.projectId, {
        $inc: { completedTasks: 1 },
      });
    }

    // SEND NOTIFICATIONS
    await NotificationService.sendTaskStatusUpdate(
      id,
      oldStatus,
      status,
      req.user._id,
    );

    // Special notifications based on status
    if (status === "submitted") {
      await NotificationService.sendTaskSubmitted(id, req.user._id);
      await notifyAllManagersAndAdmins(task, req.user);
    } else if (status === "completed") {
      await NotificationService.sendTaskApproved(id, req.user._id);
    } else if (status === "rejected" && rejectionReason) {
      await NotificationService.sendTaskRejected(
        id,
        req.user._id,
        rejectionReason,
      );
    }

    res.json({
      success: true,
      message: `Task status updated to ${status}`,
      data: task,
    });
  } catch (error) {
    console.error("Update status error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error: " + error.message });
  }
};
// Evidance Submit
const submitEvidence = async (req, res) => {
  try {
    const { id } = req.params;
    const { evidenceUrls } = req.body;

    if (
      !evidenceUrls ||
      !Array.isArray(evidenceUrls) ||
      evidenceUrls.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one evidence URL is required",
      });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Check if user is assigned to this task
    if (task.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this task",
      });
    }

    // Merge evidence URLs
    const existingUrls = task.evidenceUrls || [];
    const allUrls = [...new Set([...existingUrls, ...evidenceUrls])];

    const updatedTask = await Task.findByIdAndUpdate(
      id,
      {
        $set: {
          evidenceUrls: allUrls,
          evidenceSubmitted: true,
          evidenceSubmittedAt: new Date(),
        },
      },
      { new: true },
    ).populate("assignedTo", "fullName email");

    res.json({
      success: true,
      message: "Evidence submitted successfully",
      data: updatedTask,
    });
  } catch (error) {
    console.error("Submit evidence error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};
// the helper function:
const notifyAllManagersAndAdmins = async (task, submitter) => {
  try {
    // Get all users with management roles
    const managementRoles = [
      "admin",
      "super_admin",
      "dept_manager",
      "project_manager",
      "line_manager",
      "hr_manager",
    ];

    const managers = await User.find({
      role: { $in: managementRoles },
      isActive: true,
    }).select("_id fullName email");

    const submitterName = submitter?.fullName || "Employee";

    for (const manager of managers) {
      // Don't notify the submitter if they are also a manager
      if (manager._id.toString() === submitter?._id?.toString()) continue;

      await createNotification({
        userId: manager._id,
        title: "Task Ready for Review",
        message: `${submitterName} has submitted task "${task.title}" for review. Please review and approve/reject.`,
        type: "warning",
        category: "approval",
        taskId: task._id,
        taskTitle: task.title,
        actionUrl: `/tasks/${task._id}`,
        metadata: {
          submitter: submitterName,
          projectName: task.projectId?.name,
          priority: task.priority,
          deadline: task.deadline,
        },
      });
    }

    console.log(
      `✅ Notified ${managers.length} managers/admins about task submission`,
    );
  } catch (error) {
    console.error("Error notifying managers:", error);
  }
};

// Request extension
const requestExtension = async (req, res) => {
  try {
    const { id } = req.params;
    const { requestedDate, reason } = req.body;

    if (!requestedDate || !reason) {
      return res.status(400).json({
        success: false,
        message: "Requested date and reason are required",
      });
    }

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
    )
      .populate("assignedTo", "fullName email")
      .populate("assignedBy", "fullName email");

    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    res.json({
      success: true,
      message: "Extension request submitted successfully",
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
    const { newDeadline } = req.body;

    const task = await Task.findOneAndUpdate(
      { _id: id, "extensionRequests._id": extensionId },
      {
        $set: {
          "extensionRequests.$.status": "approved",
          "extensionRequests.$.approvedBy": req.user._id,
          revisedDeadline: new Date(newDeadline),
        },
      },
      { new: true },
    )
      .populate("assignedTo", "fullName email")
      .populate("assignedBy", "fullName email");

    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task or extension not found" });
    }

    res.json({
      success: true,
      message: "Extension approved successfully",
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

    const task = await Task.findById(id);
    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    // Update project task count before deletion
    await Project.findByIdAndUpdate(task.projectId, {
      $inc: {
        tasksCount: -1,
        completedTasks: task.status === "completed" ? -1 : 0,
      },
    });

    await Task.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    console.error("Delete task error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============= BULK OPERATIONS =============

// Bulk create tasks for a project
const bulkCreateTasks = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { projectId } = req.params;
    const { tasks } = req.body;
    const user = req.user;

    // Validate project exists
    const project = await Project.findById(projectId).session(session);
    if (!project) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Validate tasks array
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Tasks array is required and cannot be empty",
      });
    }

    if (tasks.length > 100) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Maximum 100 tasks per bulk upload",
      });
    }

    // Validate each task
    const validationErrors = [];
    const validTasks = [];
    const currentTaskCount = await Task.countDocuments({ projectId });

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const errors = [];

      if (!task.title) errors.push(`Task ${i + 1}: Title is required`);
      if (!task.description)
        errors.push(`Task ${i + 1}: Description is required`);
      if (!task.assignedTo)
        errors.push(`Task ${i + 1}: AssignedTo is required`);
      if (!task.deadline) errors.push(`Task ${i + 1}: Deadline is required`);

      // Validate assigned user exists and belongs to project department
      if (task.assignedTo) {
        const assignedUser = await User.findById(task.assignedTo).session(
          session,
        );
        if (!assignedUser) {
          errors.push(`Task ${i + 1}: Assigned user not found`);
        } else if (
          assignedUser.departmentId &&
          project.departmentId &&
          assignedUser.departmentId.toString() !==
            project.departmentId.toString()
        ) {
          errors.push(`Task ${i + 1}: User not in project's department`);
        }
      }

      if (errors.length > 0) {
        validationErrors.push(...errors);
      } else {
        validTasks.push({
          title: task.title,
          description: task.description,
          projectId: projectId,
          project: project.name,
          assignedTo: task.assignedTo,
          assignedBy: user._id,
          departmentId: project.departmentId,
          priority: task.priority || "normal",
          status: "pending",
          estimatedHours: task.estimatedHours || 0,
          deadline: new Date(task.deadline),
          isApprovalRequired: task.isApprovalRequired || false,
          evidenceRequired: task.evidenceRequired || false,
          order: currentTaskCount + i,
        });
      }
    }

    if (validationErrors.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        errors: validationErrors,
      });
    }

    // Bulk insert tasks
    const createdTasks = await Task.insertMany(validTasks, { session });

    // Update project task counts
    await Project.findByIdAndUpdate(
      projectId,
      {
        $inc: {
          tasksCount: createdTasks.length,
        },
      },
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    // Populate the created tasks
    const populatedTasks = await Task.find({
      _id: { $in: createdTasks.map((t) => t._id) },
    })
      .populate("assignedTo", "fullName email employeeId")
      .populate("assignedBy", "fullName email")
      .populate("projectId", "name code");

    // Send notifications for each created task
    for (const task of populatedTasks) {
      await NotificationService.sendTaskAssigned(task._id);
      // Add delay to avoid overwhelming email server
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdTasks.length} tasks and sent notifications`,
      data: populatedTasks,
      stats: {
        total: createdTasks.length,
        projectId: projectId,
        projectName: project.name,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Bulk create tasks error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// Get tasks by project with pagination
const getTasksByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status, priority, page = 1, limit = 20 } = req.query;

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    let query = { projectId };
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const tasks = await Task.find(query)
      .populate("assignedTo", "fullName email employeeId")
      .populate("assignedBy", "fullName email")
      .sort({ order: 1, createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await Task.countDocuments(query);

    // Calculate project stats
    const stats = {
      total: await Task.countDocuments({ projectId }),
      pending: await Task.countDocuments({ projectId, status: "pending" }),
      inProgress: await Task.countDocuments({
        projectId,
        status: "in_progress",
      }),
      submitted: await Task.countDocuments({ projectId, status: "submitted" }),
      completed: await Task.countDocuments({ projectId, status: "completed" }),
      overdue: await Task.countDocuments({ projectId, status: "overdue" }),
      rejected: await Task.countDocuments({ projectId, status: "rejected" }),
    };

    // Get total estimated hours
    const estimatedHoursResult = await Task.aggregate([
      { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
      { $group: { _id: null, total: { $sum: "$estimatedHours" } } },
    ]);

    stats.totalEstimatedHours = estimatedHoursResult[0]?.total || 0;

    res.json({
      success: true,
      data: tasks,
      project: {
        id: project._id,
        name: project.name,
        code: project.code,
        progress: project.progress,
        tasksCount: project.tasksCount,
        completedTasks: project.completedTasks,
      },
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get tasks by project error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Import tasks from JSON
const importTasksFromFile = async (req, res) => {
  try {
    const { projectId } = req.params;
    const tasksData = req.body.tasks;
    const user = req.user;

    // Validate project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    if (!tasksData || !Array.isArray(tasksData) || tasksData.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Tasks array is required",
      });
    }

    // Process and validate each task
    const results = {
      successful: [],
      failed: [],
      total: tasksData.length,
    };

    const currentTaskCount = await Task.countDocuments({ projectId });

    for (let i = 0; i < tasksData.length; i++) {
      const taskData = tasksData[i];
      try {
        // Validate required fields
        if (
          !taskData.title ||
          !taskData.description ||
          !taskData.assignedTo ||
          !taskData.deadline
        ) {
          results.failed.push({
            index: i,
            task: taskData,
            error:
              "Missing required fields: title, description, assignedTo, deadline",
          });
          continue;
        }

        // Check if assigned user exists
        const assignedUser = await User.findById(taskData.assignedTo);
        if (!assignedUser) {
          results.failed.push({
            index: i,
            task: taskData,
            error: "Assigned user not found",
          });
          continue;
        }

        // Create task
        const task = await Task.create({
          title: taskData.title,
          description: taskData.description,
          projectId: projectId,
          project: project.name,
          assignedTo: taskData.assignedTo,
          assignedBy: user._id,
          departmentId: project.departmentId,
          priority: taskData.priority || "normal",
          estimatedHours: taskData.estimatedHours || 0,
          deadline: new Date(taskData.deadline),
          isApprovalRequired: taskData.isApprovalRequired || false,
          evidenceRequired: taskData.evidenceRequired || false,
          order: currentTaskCount + results.successful.length,
        });

        results.successful.push(task);
      } catch (error) {
        results.failed.push({
          index: i,
          task: taskData,
          error: error.message,
        });
      }
    }

    // Update project task count
    if (results.successful.length > 0) {
      await Project.findByIdAndUpdate(projectId, {
        $inc: { tasksCount: results.successful.length },
      });
    }

    // Send notifications for successfully created tasks
    for (const task of results.successful) {
      await NotificationService.sendTaskAssigned(task._id);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    res.json({
      success: true,
      message: `Imported ${results.successful.length} out of ${results.total} tasks and sent notifications`,
      data: results,
    });
  } catch (error) {
    console.error("Import tasks error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// Reorder tasks within a project
const reorderTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { taskOrders } = req.body;

    if (!taskOrders || !Array.isArray(taskOrders)) {
      return res.status(400).json({
        success: false,
        message: "taskOrders array is required",
      });
    }

    const bulkOps = taskOrders.map((item) => ({
      updateOne: {
        filter: { _id: item.taskId, projectId: projectId },
        update: { $set: { order: item.order } },
      },
    }));

    const result = await Task.bulkWrite(bulkOps);

    res.json({
      success: true,
      message: "Tasks reordered successfully",
      data: {
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount,
      },
    });
  } catch (error) {
    console.error("Reorder tasks error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get project tasks summary
const getProjectTasksSummary = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const summary = await Task.aggregate([
      { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalEstimatedHours: { $sum: "$estimatedHours" },
        },
      },
    ]);

    const assignedUsers = await Task.distinct("assignedTo", { projectId });
    const assignedUsersDetails = await User.find(
      { _id: { $in: assignedUsers } },
      "fullName email employeeId",
    );

    // Get priority distribution
    const priorityDistribution = await Task.aggregate([
      { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        statusSummary: summary,
        priorityDistribution: priorityDistribution,
        totalAssignedUsers: assignedUsers.length,
        assignedUsersList: assignedUsersDetails,
        projectProgress: {
          tasksCount: project.tasksCount,
          completedTasks: project.completedTasks,
          progressPercentage: project.progress,
        },
      },
    });
  } catch (error) {
    console.error("Project tasks summary error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get task statistics for dashboard
const getTaskStatistics = async (req, res) => {
  try {
    const user = req.user;
    const { period = "month" } = req.query;

    let dateFilter = {};
    const now = new Date();

    if (period === "week") {
      const weekAgo = new Date(now.setDate(now.getDate() - 7));
      dateFilter = { createdAt: { $gte: weekAgo } };
    } else if (period === "month") {
      const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
      dateFilter = { createdAt: { $gte: monthAgo } };
    } else if (period === "year") {
      const yearAgo = new Date(now.setFullYear(now.getFullYear() - 1));
      dateFilter = { createdAt: { $gte: yearAgo } };
    }

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

    const stats = {
      total: await Task.countDocuments({ ...query, ...dateFilter }),
      byStatus: {
        pending: await Task.countDocuments({
          ...query,
          ...dateFilter,
          status: "pending",
        }),
        inProgress: await Task.countDocuments({
          ...query,
          ...dateFilter,
          status: "in_progress",
        }),
        submitted: await Task.countDocuments({
          ...query,
          ...dateFilter,
          status: "submitted",
        }),
        completed: await Task.countDocuments({
          ...query,
          ...dateFilter,
          status: "completed",
        }),
        overdue: await Task.countDocuments({
          ...query,
          ...dateFilter,
          status: "overdue",
        }),
        rejected: await Task.countDocuments({
          ...query,
          ...dateFilter,
          status: "rejected",
        }),
      },
      byPriority: {
        low: await Task.countDocuments({
          ...query,
          ...dateFilter,
          priority: "low",
        }),
        normal: await Task.countDocuments({
          ...query,
          ...dateFilter,
          priority: "normal",
        }),
        high: await Task.countDocuments({
          ...query,
          ...dateFilter,
          priority: "high",
        }),
        urgent: await Task.countDocuments({
          ...query,
          ...dateFilter,
          priority: "urgent",
        }),
      },
    };

    // Calculate completion rate
    const totalTasks = stats.total;
    const completedTasks = stats.byStatus.completed;
    stats.completionRate =
      totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(2) : 0;

    res.json({
      success: true,
      data: stats,
      period: period,
    });
  } catch (error) {
    console.error("Get task statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
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
  bulkCreateTasks,
  getTasksByProject,
  importTasksFromFile,
  reorderTasks,
  getProjectTasksSummary,
  getTaskStatistics,
  submitEvidence,
};
