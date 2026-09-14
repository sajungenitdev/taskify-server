// src/controllers/crm/lead.controller.js
const Lead = require("../../models/Lead.model");
const Contact = require("../../models/Contact.model");
const Client = require("../../models/Client.model");
const DealActivity = require("../../models/DealActivity.model");
const DealStageConfig = require("../../models/DealStageConfig.model");
const { Task } = require("../../models/Task.model");
const { Project } = require("../../models/Project.model");
const { calculateLeadScore } = require("../../services/crm/leadScoring.service");
const {
    scopeFilter,
    canAccessRecord,
} = require("../../middleware/crm.permissions");

// ============================================================
// LIST / FILTER (supports pipeline board view)
// ============================================================
const listLeads = async (req, res) => {
    try {
        const {
            stage,
            owner,
            search,
            from,
            to,
            page = 1,
            limit = 200,
            groupByStage = "false",
        } = req.query;

        const query = { ...scopeFilter(req.user, "owner") };
        if (stage && stage !== "all") query.stage = stage;
        if (owner) query.owner = owner;
        if (search) {
            query.$or = [
                { companyName: { $regex: search, $options: "i" } },
                { dealName: { $regex: search, $options: "i" } },
            ];
        }
        if (from || to) {
            query.expectedCloseDate = {};
            if (from) query.expectedCloseDate.$gte = new Date(from);
            if (to) query.expectedCloseDate.$lte = new Date(to);
        }

        const leads = await Lead.find(query)
            .populate("contactId", "name company email phone tag")
            .populate("owner", "fullName email")
            .sort({ stage: 1, updatedAt: -1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit))
            .lean();

        const total = await Lead.countDocuments(query);

        if (groupByStage === "true") {
            const stages = await DealStageConfig.find().sort({ order: 1 }).lean();

            const grouped = stages.map((s) => {
                const inStage = leads.filter((l) => l.stage === s.stageKey);
                const weighted = inStage.reduce(
                    (sum, l) =>
                        sum + (l.value * (l.probability ?? s.defaultProbability)) / 100,
                    0
                );
                const raw = inStage.reduce((sum, l) => sum + l.value, 0);

                return {
                    stage: s.stageKey,
                    label: s.label,
                    order: s.order,
                    defaultProbability: s.defaultProbability,
                    color: s.color,
                    count: inStage.length,
                    weighted: Math.round(weighted * 100) / 100,
                    raw,
                    leads: inStage,
                };
            });

            const totalWeighted = grouped.reduce((s, g) => s + g.weighted, 0);
            const totalRaw = grouped.reduce((s, g) => s + g.raw, 0);

            return res.json({
                success: true,
                data: {
                    grouped,
                    totals: {
                        weighted: Math.round(totalWeighted * 100) / 100,
                        raw: totalRaw,
                    },
                },
            });
        }

        res.json({
            success: true,
            data: leads,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        console.error("listLeads error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// GET ONE (with activities + contact + project)
// ============================================================
const getLead = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id)
            .populate("contactId")
            .populate("owner", "fullName email")
            .populate("projectId", "name code status")
            .populate("clientId", "name sector stage")
            .lean();

        if (!lead)
            return res.status(404).json({ success: false, message: "Lead not found" });

        if (!canAccessRecord(req.user, lead))
            return res.status(403).json({ success: false, message: "Not authorized" });

        const activities = await DealActivity.find({ leadId: lead._id })
            .populate("createdBy", "fullName email")
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        res.json({
            success: true,
            data: { ...lead, activities },
        });
    } catch (error) {
        console.error("getLead error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// CREATE
// ============================================================
const createLead = async (req, res) => {
    try {
        const {
            contactId,
            companyName,
            dealName,
            value,
            currency,
            probability,
            expectedCloseDate,
            stage,
            tags,
            notes,
            departmentId,
        } = req.body;

        if (!contactId)
            return res.status(400).json({ success: false, message: "contactId is required" });
        if (!companyName?.trim())
            return res.status(400).json({ success: false, message: "companyName is required" });
        if (typeof value !== "number" || value <= 0)
            return res.status(400).json({ success: false, message: "value must be > 0" });

        const contact = await Contact.findById(contactId);
        if (!contact)
            return res.status(404).json({ success: false, message: "Contact not found" });

        if (!canAccessRecord(req.user, contact))
            return res.status(403).json({ success: false, message: "Not authorized on contact" });

        // Resolve default probability from stage config
        const stageKey = stage || "lead_in";
        const stageCfg = await DealStageConfig.findOne({ stageKey }).lean();
        const prob = probability ?? stageCfg?.defaultProbability ?? 10;

        // Build the lead first so we can score it
        const lead = new Lead({
            contactId,
            companyName: companyName.trim(),
            dealName: dealName?.trim() || "",
            stage: stageKey,
            value: Number(value),
            currency: currency || "BDT",
            probability: prob,
            expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
            owner: req.user._id,
            tags: Array.isArray(tags) ? tags : [],
            notes: notes?.trim() || "",
            departmentId: departmentId || req.user.departmentId,
            createdBy: req.user._id,
            updatedBy: req.user._id,
            stageHistory: [
                { from: null, to: stageKey, at: new Date(), by: req.user._id },
            ],
        });

        // Compute score
        const { score, scoreBreakdown } = calculateLeadScore(lead, contact);
        lead.score = score;
        lead.scoreBreakdown = scoreBreakdown;

        await lead.save();

        // Link back on contact
        contact.leadId = lead._id;
        await contact.save();

        // Log initial activity
        await DealActivity.create({
            leadId: lead._id,
            type: "stage_change",
            summary: `Lead created in stage "${stageCfg?.label || stageKey}"`,
            metadata: { fromStage: null, toStage: stageKey },
            createdBy: req.user._id,
        });

        res.status(201).json({ success: true, data: lead });
    } catch (error) {
        console.error("createLead error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// UPDATE
// ============================================================
const updateLead = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead)
            return res.status(404).json({ success: false, message: "Lead not found" });

        if (!canAccessRecord(req.user, lead))
            return res.status(403).json({ success: false, message: "Not authorized" });

        const allowed = [
            "companyName",
            "dealName",
            "value",
            "currency",
            "probability",
            "expectedCloseDate",
            "tags",
            "notes",
            "departmentId",
            "lostReason",
        ];

        for (const k of allowed) {
            if (req.body[k] !== undefined) {
                if (k === "expectedCloseDate" && req.body[k]) {
                    lead[k] = new Date(req.body[k]);
                } else {
                    lead[k] = req.body[k];
                }
            }
        }
        lead.updatedBy = req.user._id;

        // Recompute score if value/contact-ish fields changed
        const contact = await Contact.findById(lead.contactId).lean();
        if (contact) {
            const { score, scoreBreakdown } = calculateLeadScore(lead, contact);
            lead.score = score;
            lead.scoreBreakdown = scoreBreakdown;
        }

        await lead.save();
        res.json({ success: true, data: lead });
    } catch (error) {
        console.error("updateLead error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// PATCH STAGE (drag between columns)
//  - updates probability from stage config
//  - writes a stage_change activity
//  - sets closedAt when moving to won/lost
// ============================================================
const changeStage = async (req, res) => {
    try {
        const { stage, note, lostReason } = req.body;
        if (!stage)
            return res.status(400).json({ success: false, message: "stage is required" });

        const stageCfg = await DealStageConfig.findOne({ stageKey: stage }).lean();
        if (!stageCfg)
            return res.status(400).json({ success: false, message: "Unknown stage" });

        const lead = await Lead.findById(req.params.id);
        if (!lead)
            return res.status(404).json({ success: false, message: "Lead not found" });

        if (!canAccessRecord(req.user, lead))
            return res.status(403).json({ success: false, message: "Not authorized" });

        const fromStage = lead.stage;
        if (fromStage === stage) {
            return res.json({ success: true, data: lead, message: "Already in this stage" });
        }

        lead.stage = stage;
        lead.probability = stageCfg.defaultProbability;
        lead.updatedBy = req.user._id;

        if (stageCfg.isTerminal) {
            lead.closedAt = new Date();
            if (stage === "lost" && lostReason) lead.lostReason = lostReason;
        } else {
            lead.closedAt = null;
        }

        lead.stageHistory.push({
            from: fromStage,
            to: stage,
            at: new Date(),
            by: req.user._id,
            note: note || "",
        });

        await lead.save();

        await DealActivity.create({
            leadId: lead._id,
            type: "stage_change",
            summary: `Stage moved: ${fromStage} → ${stage}`,
            details: note || "",
            metadata: { fromStage, toStage: stage },
            createdBy: req.user._id,
        });

        // TODO: emit event / trigger notification to owner

        res.json({ success: true, data: lead });
    } catch (error) {
        console.error("changeStage error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// CONVERT TO PROJECT (Won → Project) — idempotent
// ============================================================
const convertToProject = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead)
            return res.status(404).json({ success: false, message: "Lead not found" });

        if (!canAccessRecord(req.user, lead))
            return res.status(403).json({ success: false, message: "Not authorized" });

        if (lead.stage !== "won") {
            return res
                .status(400)
                .json({ success: false, message: "Only 'won' leads can be converted" });
        }

        // Idempotency: if already converted, return the existing project
        if (lead.projectId) {
            const existing = await Project.findById(lead.projectId).lean();
            return res.json({
                success: true,
                data: existing,
                message: "Lead already converted",
            });
        }

        const { name, code, startDate, endDate, managerId, description } = req.body;

        const project = await Project.create({
            name: name || lead.dealName || lead.companyName,
            code: code || `PRJ-${Date.now()}`,
            description: description || lead.notes || "",
            startDate: startDate ? new Date(startDate) : new Date(),
            endDate: endDate ? new Date(endDate) : null,
            managerId: managerId || lead.owner,
            value: lead.value,
            currency: lead.currency,
            clientId: lead.clientId || null,
            departmentId: lead.departmentId || req.user.departmentId,
            createdBy: req.user._id,
            updatedBy: req.user._id,
        });

        lead.projectId = project._id;
        lead.updatedBy = req.user._id;
        await lead.save();

        await DealActivity.create({
            leadId: lead._id,
            type: "stage_change",
            summary: `Converted to project "${project.name}"`,
            metadata: { projectId: project._id },
            createdBy: req.user._id,
        });

        res.status(201).json({ success: true, data: project });
    } catch (error) {
        console.error("convertToProject error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// RESCORE
// ============================================================
const rescoreLead = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead)
            return res.status(404).json({ success: false, message: "Lead not found" });

        if (!canAccessRecord(req.user, lead))
            return res.status(403).json({ success: false, message: "Not authorized" });

        const contact = await Contact.findById(lead.contactId).lean();
        if (!contact)
            return res.status(400).json({ success: false, message: "Contact missing" });

        const { score, scoreBreakdown } = calculateLeadScore(lead, contact);
        lead.score = score;
        lead.scoreBreakdown = scoreBreakdown;
        lead.updatedBy = req.user._id;
        await lead.save();

        res.json({ success: true, data: { score, scoreBreakdown } });
    } catch (error) {
        console.error("rescoreLead error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// DELETE (hard delete allowed for leads; cascade activities)
// ============================================================
const deleteLead = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead)
            return res.status(404).json({ success: false, message: "Lead not found" });

        if (!canAccessRecord(req.user, lead))
            return res.status(403).json({ success: false, message: "Not authorized" });

        // Unlink contact
        await Contact.updateOne(
            { _id: lead.contactId, leadId: lead._id },
            { $set: { leadId: null } }
        );

        await DealActivity.deleteMany({ leadId: lead._id });
        await lead.deleteOne();

        res.json({ success: true, message: "Lead deleted" });
    } catch (error) {
        console.error("deleteLead error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// SCHEDULE FOLLOW-UP → creates a real Phase 1 task
// ============================================================
const scheduleFollowUp = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead)
            return res.status(404).json({ success: false, message: "Lead not found" });

        if (!canAccessRecord(req.user, lead))
            return res.status(403).json({ success: false, message: "Not authorized" });

        const { title, dueAt, notes, priority, assigneeId } = req.body;
        if (!dueAt)
            return res.status(400).json({ success: false, message: "dueAt is required" });

        const task = await Task.create({
            title: title || `Follow up: ${lead.companyName}`,
            description: notes || "",
            dueDate: new Date(dueAt),
            priority: priority || "medium",
            assignedTo: assigneeId || lead.owner,
            createdBy: req.user._id,
            updatedBy: req.user._id,
            status: "todo",
            departmentId: lead.departmentId || req.user.departmentId,
            linkedEntity: { type: "lead", id: lead._id },
        });

        lead.lastActivityAt = new Date();
        await lead.save();

        await DealActivity.create({
            leadId: lead._id,
            type: "follow_up",
            summary: `Follow-up scheduled: ${task.title}`,
            details: notes || "",
            scheduledFor: task.dueDate,
            metadata: { taskId: task._id },
            createdBy: req.user._id,
        });

        res.status(201).json({ success: true, data: task });
    } catch (error) {
        console.error("scheduleFollowUp error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    listLeads,
    getLead,
    createLead,
    updateLead,
    changeStage,
    convertToProject,
    rescoreLead,
    deleteLead,
    scheduleFollowUp,
};