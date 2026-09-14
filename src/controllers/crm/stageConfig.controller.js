// src/controllers/crm/stageConfig.controller.js
const DealStageConfig = require("../../models/DealStageConfig.model");
const { isAdmin } = require("../../middleware/crm.permissions");

// ============================================================
// LIST all stages (ordered)
// ============================================================
const listStages = async (req, res) => {
    try {
        const stages = await DealStageConfig.find().sort({ order: 1 }).lean();
        res.json({ success: true, data: stages });
    } catch (error) {
        console.error("listStages error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// UPSERT a stage (admin only)
// ============================================================
const upsertStage = async (req, res) => {
    try {
        if (!isAdmin(req.user))
            return res.status(403).json({ success: false, message: "Admin only" });

        const { stageKey, label, defaultProbability, order, isTerminal, color } = req.body;
        if (!stageKey || !label || order === undefined) {
            return res
                .status(400)
                .json({ success: false, message: "stageKey, label, order required" });
        }

        const stage = await DealStageConfig.findOneAndUpdate(
            { stageKey },
            {
                $set: {
                    label,
                    defaultProbability: defaultProbability ?? 0,
                    order,
                    isTerminal: !!isTerminal,
                    color: color || "#64748b",
                },
            },
            { new: true, upsert: true, runValidators: true }
        );

        res.json({ success: true, data: stage });
    } catch (error) {
        console.error("upsertStage error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { listStages, upsertStage };