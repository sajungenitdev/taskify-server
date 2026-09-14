// src/controllers/crm/activity.controller.js
const DealActivity = require("../../models/DealActivity.model");
const Lead = require("../../models/Lead.model");
const {
    canAccessRecord,
    scopeFilter,
} = require("../../middleware/crm.permissions");

// ============================================================
// LIST activities for a lead
// ============================================================
const listActivities = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead)
            return res.status(404).json({ success: false, message: "Lead not found" });
        if (!canAccessRecord(req.user, lead))
            return res.status(403).json({ success: false, message: "Not authorized" });

        const { type, page = 1, limit = 50 } = req.query;
        const query = { leadId: lead._id };
        if (type && type !== "all") query.type = type;

        const [activities, total] = await Promise.all([
            DealActivity.find(query)
                .populate("createdBy", "fullName email")
                .sort({ createdAt: -1 })
                .skip((parseInt(page) - 1) * parseInt(limit))
                .limit(parseInt(limit))
                .lean(),
            DealActivity.countDocuments(query),
        ]);

        res.json({
            success: true,
            data: activities,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        console.error("listActivities error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// CREATE activity
//  - bumps lead.lastActivityAt + engagement counters
// ============================================================
const createActivity = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead)
            return res.status(404).json({ success: false, message: "Lead not found" });
        if (!canAccessRecord(req.user, lead))
            return res.status(403).json({ success: false, message: "Not authorized" });

        const { type, summary, details, duration, scheduledFor, metadata } = req.body;

        if (!type || !summary) {
            return res
                .status(400)
                .json({ success: false, message: "type and summary are required" });
        }

        const activity = await DealActivity.create({
            leadId: lead._id,
            type,
            summary: summary.trim(),
            details: details || "",
            duration: Number(duration) || 0,
            scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
            metadata: metadata || {},
            createdBy: req.user._id,
        });

        // Update lead engagement counters
        const inc = {};
        if (type === "email") inc["engagement.emailsSent"] = 1;
        if (type === "call") inc["engagement.callsMade"] = 1;
        if (type === "meeting") inc["engagement.meetingsHeld"] = 1;

        const update = {
            lastActivityAt: new Date(),
            ...inc,
        };
        update["engagement.lastEngagementAt"] = new Date();

        await Lead.updateOne({ _id: lead._id }, { $set: update });

        res.status(201).json({ success: true, data: activity });
    } catch (error) {
        console.error("createActivity error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// UPDATE activity (owner only / manager)
// ============================================================
const updateActivity = async (req, res) => {
    try {
        const activity = await DealActivity.findById(req.params.id);
        if (!activity)
            return res.status(404).json({ success: false, message: "Activity not found" });

        // Only creator or managers
        const isCreator = activity.createdBy.toString() === req.user._id.toString();
        if (!isCreator) {
            // fall through to record check via lead
            const lead = await Lead.findById(activity.leadId);
            if (!lead || !canAccessRecord(req.user, lead)) {
                return res.status(403).json({ success: false, message: "Not authorized" });
            }
        }

        const allowed = ["summary", "details", "duration", "scheduledFor"];
        for (const k of allowed) {
            if (req.body[k] !== undefined) activity[k] = req.body[k];
        }
        await activity.save();

        res.json({ success: true, data: activity });
    } catch (error) {
        console.error("updateActivity error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// DELETE activity
// ============================================================
const deleteActivity = async (req, res) => {
    try {
        const activity = await DealActivity.findById(req.params.id);
        if (!activity)
            return res.status(404).json({ success: false, message: "Activity not found" });

        const lead = await Lead.findById(activity.leadId);
        if (!lead || !canAccessRecord(req.user, lead))
            return res.status(403).json({ success: false, message: "Not authorized" });

        await activity.deleteOne();
        res.json({ success: true, message: "Activity deleted" });
    } catch (error) {
        console.error("deleteActivity error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// MY ACTIVITY FEED (across all leads owned by user)
// ============================================================
const myActivityFeed = async (req, res) => {
    try {
        const { page = 1, limit = 50, type } = req.query;
        const query = scopeFilter(req.user, "createdBy");
        if (type && type !== "all") query.type = type;

        const [activities, total] = await Promise.all([
            DealActivity.find(query)
                .populate("leadId", "companyName dealName stage value currency")
                .populate("createdBy", "fullName email")
                .sort({ createdAt: -1 })
                .skip((parseInt(page) - 1) * parseInt(limit))
                .limit(parseInt(limit))
                .lean(),
            DealActivity.countDocuments(query),
        ]);

        res.json({
            success: true,
            data: activities,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        console.error("myActivityFeed error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    listActivities,
    createActivity,
    updateActivity,
    deleteActivity,
    myActivityFeed,
};