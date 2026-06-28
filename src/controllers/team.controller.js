const Team = require("../models/team.model");
const User = require("../models/user.model");
const mongoose = require("mongoose");

// Get all teams with filters
exports.getAllTeams = async (req, res, next) => {
  try {
    const { department, status, search } = req.query;

    // Build filter
    const filter = {};
    if (department) filter.department = department;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const teams = await Team.find(filter)
      .populate("lead", "name email avatar role")
      .populate("members", "name email avatar role position")
      .sort({ createdAt: -1 });

    // Add member count to each team
    const teamsWithCount = teams.map((team) => ({
      ...team.toObject(),
      memberCount: team.members.length,
    }));

    res.status(200).json({
      success: true,
      count: teams.length,
      data: teamsWithCount,
    });
  } catch (error) {
    next(error);
  }
};

// Get single team by ID
exports.getTeamById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID",
      });
    }

    const team = await Team.findById(id)
      .populate("lead", "name email avatar role position")
      .populate("members", "name email avatar role position department");

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ...team.toObject(),
        memberCount: team.members.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Create new team
exports.createTeam = async (req, res, next) => {
  try {
    const {
      name,
      description,
      department,
      lead,
      members,
      status,
      color,
      icon,
    } = req.body;

    // Check if team name already exists
    const existingTeam = await Team.findOne({ name });
    if (existingTeam) {
      return res.status(400).json({
        success: false,
        message: "Team with this name already exists",
      });
    }

    // Verify lead exists
    const leadUser = await User.findById(lead);
    if (!leadUser) {
      return res.status(404).json({
        success: false,
        message: "Team lead not found",
      });
    }

    // Verify all members exist
    if (members && members.length > 0) {
      const existingMembers = await User.find({ _id: { $in: members } });
      if (existingMembers.length !== members.length) {
        return res.status(404).json({
          success: false,
          message: "One or more members not found",
        });
      }
    }

    // Create team
    const team = await Team.create({
      name,
      description,
      department,
      lead,
      members: members || [],
      status: status || "active",
      color,
      icon,
    });

    // Populate the created team
    const populatedTeam = await Team.findById(team._id)
      .populate("lead", "name email avatar")
      .populate("members", "name email avatar");

    res.status(201).json({
      success: true,
      message: "Team created successfully",
      data: populatedTeam,
    });
  } catch (error) {
    next(error);
  }
};

// Update team
exports.updateTeam = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      department,
      lead,
      members,
      status,
      color,
      icon,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID",
      });
    }

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    // Check if name is being changed and if it already exists
    if (name && name !== team.name) {
      const existingTeam = await Team.findOne({ name });
      if (existingTeam) {
        return res.status(400).json({
          success: false,
          message: "Team with this name already exists",
        });
      }
    }

    // Verify lead exists if being updated
    if (lead) {
      const leadUser = await User.findById(lead);
      if (!leadUser) {
        return res.status(404).json({
          success: false,
          message: "Team lead not found",
        });
      }
    }

    // Verify members exist if being updated
    if (members && members.length > 0) {
      const existingMembers = await User.find({ _id: { $in: members } });
      if (existingMembers.length !== members.length) {
        return res.status(404).json({
          success: false,
          message: "One or more members not found",
        });
      }
    }

    // Update team
    const updatedTeam = await Team.findByIdAndUpdate(
      id,
      {
        name,
        description,
        department,
        lead,
        members,
        status,
        color,
        icon,
      },
      { new: true, runValidators: true },
    )
      .populate("lead", "name email avatar")
      .populate("members", "name email avatar");

    res.status(200).json({
      success: true,
      message: "Team updated successfully",
      data: updatedTeam,
    });
  } catch (error) {
    next(error);
  }
};

// Delete team
exports.deleteTeam = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID",
      });
    }

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    await team.deleteOne();

    res.status(200).json({
      success: true,
      message: "Team deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Add members to team
exports.addMembers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { memberIds } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID",
      });
    }

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide member IDs to add",
      });
    }

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    // Verify all members exist
    const existingMembers = await User.find({ _id: { $in: memberIds } });
    if (existingMembers.length !== memberIds.length) {
      return res.status(404).json({
        success: false,
        message: "One or more members not found",
      });
    }

    // Add members (avoid duplicates)
    const currentMemberIds = team.members.map((m) => m.toString());
    const newMembers = memberIds.filter((id) => !currentMemberIds.includes(id));

    if (newMembers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "All members are already in the team",
      });
    }

    team.members.push(...newMembers);
    team.teamSize = team.members.length;
    await team.save();

    const updatedTeam = await Team.findById(id)
      .populate("lead", "name email avatar")
      .populate("members", "name email avatar role");

    res.status(200).json({
      success: true,
      message: "Members added successfully",
      data: updatedTeam,
    });
  } catch (error) {
    next(error);
  }
};

// Remove member from team
exports.removeMember = async (req, res, next) => {
  try {
    const { id, memberId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(memberId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID provided",
      });
    }

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    // Check if member is in team
    if (!team.members.includes(memberId)) {
      return res.status(404).json({
        success: false,
        message: "Member not found in this team",
      });
    }

    // Remove member
    team.members = team.members.filter((m) => m.toString() !== memberId);
    team.teamSize = team.members.length;
    await team.save();

    const updatedTeam = await Team.findById(id)
      .populate("lead", "name email avatar")
      .populate("members", "name email avatar role");

    res.status(200).json({
      success: true,
      message: "Member removed successfully",
      data: updatedTeam,
    });
  } catch (error) {
    next(error);
  }
};

// Get team members
exports.getTeamMembers = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID",
      });
    }

    const team = await Team.findById(id).populate(
      "members",
      "name email role avatar position department",
    );
    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    res.status(200).json({
      success: true,
      count: team.members.length,
      data: team.members,
    });
  } catch (error) {
    next(error);
  }
};

// Get user's teams
exports.getUserTeams = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const teams = await Team.find({
      $or: [{ lead: userId }, { members: userId }],
      status: "active",
    })
      .populate("lead", "name email avatar")
      .populate("members", "name email avatar");

    res.status(200).json({
      success: true,
      count: teams.length,
      data: teams,
    });
  } catch (error) {
    next(error);
  }
};

// Get teams by department
exports.getTeamsByDepartment = async (req, res, next) => {
  try {
    const { department } = req.params;

    const teams = await Team.find({ department, status: "active" })
      .populate("lead", "name email avatar")
      .populate("members", "name email avatar");

    res.status(200).json({
      success: true,
      count: teams.length,
      data: teams,
    });
  } catch (error) {
    next(error);
  }
};

// Get team statistics
exports.getTeamStats = async (req, res, next) => {
  try {
    const totalTeams = await Team.countDocuments();
    const activeTeams = await Team.countDocuments({ status: "active" });
    const inactiveTeams = await Team.countDocuments({ status: "inactive" });

    // Get departments with team count
    const departmentStats = await Team.aggregate([
      {
        $group: {
          _id: "$department",
          count: { $sum: 1 },
          members: { $sum: "$teamSize" },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    // Get teams with most members
    const topTeams = await Team.find({ status: "active" })
      .sort({ teamSize: -1 })
      .limit(5)
      .select("name department teamSize")
      .populate("lead", "name");

    res.status(200).json({
      success: true,
      data: {
        totalTeams,
        activeTeams,
        inactiveTeams,
        departmentStats,
        topTeams,
      },
    });
  } catch (error) {
    next(error);
  }
};
