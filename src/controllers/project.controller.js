const { Project } = require("../models/Project.model");
const { User } = require("../models/User.model");

// Get all projects with filters
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

// Get single project by ID
const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id)
      .populate("departmentId", "name code")
      .populate("managerId", "fullName email");

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

// Create project
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
      startDate,
      endDate,
      priority: priority || "normal",
      status: "active", // Set to active directly
      budget: { allocated: budget || 0, spent: 0, currency: "USD" },
      progress: 0,
      tasksCount: 0,
      completedTasks: 0,
    });

    const populatedProject = await Project.findById(project._id)
      .populate("departmentId", "name code")
      .populate("managerId", "fullName email");

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

// Update project
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
      .populate("managerId", "fullName email");

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

// Delete project
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

// Update project progress
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

// Get project templates (mock data)
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

// Get project resources (mock data)
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

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  updateProjectProgress,
  getProjectTemplates,
  getProjectResources,
};
