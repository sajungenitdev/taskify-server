// src/controllers/crm/analytics.controller.js
const Lead = require("../../models/Lead.model");
const DealActivity = require("../../models/DealActivity.model");
const Client = require("../../models/Client.model");
const {
    getWeightedForecast,
    getLeaderboard,
} = require("../../services/crm/forecast.service");
const { scopeFilter } = require("../../middleware/crm.permissions");

// ============================================================
// FORECAST
// ============================================================
const forecast = async (req, res) => {
    try {
        const { from, to, owner } = req.query;
        // Non-admins only see their own forecast
        const scope = scopeFilter(req.user, "owner");
        const ownerId = owner || (scope.owner ? scope.owner : null);

        const rows = await getWeightedForecast({ from, to, ownerId });

        const totals = rows.reduce(
            (acc, r) => {
                acc.weighted += r.weighted;
                acc.raw += r.raw;
                acc.count += r.count;
                return acc;
            },
            { weighted: 0, raw: 0, count: 0 }
        );
        totals.weighted = Math.round(totals.weighted * 100) / 100;

        res.json({ success: true, data: { rows, totals } });
    } catch (error) {
        console.error("forecast error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// LEADERBOARD
// ============================================================
const leaderboard = async (req, res) => {
    try {
        const { month, year } = req.query;
        const data = await getLeaderboard({ month, year });
        res.json({ success: true, data });
    } catch (error) {
        console.error("leaderboard error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// PIPELINE SUMMARY (grouped totals for kanban header)
// ============================================================
const pipelineSummary = async (req, res) => {
    try {
        const scope = scopeFilter(req.user, "owner");
        const match = { stage: { $nin: ["won", "lost"] }, ...scope };

        const grouped = await Lead.aggregate([
            { $match: match },
            {
                $group: {
                    _id: "$stage",
                    count: { $sum: 1 },
                    raw: { $sum: "$value" },
                    weighted: {
                        $sum: {
                            $multiply: [
                                "$value",
                                { $divide: [{ $ifNull: ["$probability", 0] }, 100] },
                            ],
                        },
                    },
                },
            },
        ]);

        const totals = grouped.reduce(
            (acc, g) => {
                acc.raw += g.raw;
                acc.weighted += g.weighted;
                acc.count += g.count;
                return acc;
            },
            { raw: 0, weighted: 0, count: 0 }
        );
        totals.weighted = Math.round(totals.weighted * 100) / 100;

        res.json({
            success: true,
            data: { byStage: grouped, totals },
        });
    } catch (error) {
        console.error("pipelineSummary error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// DASHBOARD STATS
// ============================================================
const dashboardStats = async (req, res) => {
    try {
        const scope = scopeFilter(req.user, "owner");
        const repScope = scopeFilter(req.user, "assignedRep");

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const [
            contactCount,
            openDealCount,
            wonThisMonth,
            lostThisMonth,
            pipelineTotals,
            activitiesThisMonth,
            clientCount,
            topDeals,
        ] = await Promise.all([
            require("../../models/Contact.model").countDocuments({
                isActive: true,
                ...scope,
            }),
            Lead.countDocuments({ stage: { $nin: ["won", "lost"] }, ...scope }),
            Lead.countDocuments({
                stage: "won",
                closedAt: { $gte: monthStart, $lte: monthEnd },
                ...scope,
            }),
            Lead.countDocuments({
                stage: "lost",
                closedAt: { $gte: monthStart, $lte: monthEnd },
                ...scope,
            }),
            Lead.aggregate([
                { $match: { stage: { $nin: ["won", "lost"] }, ...scope } },
                {
                    $group: {
                        _id: null,
                        raw: { $sum: "$value" },
                        weighted: {
                            $sum: {
                                $multiply: [
                                    "$value",
                                    { $divide: [{ $ifNull: ["$probability", 0] }, 100] },
                                ],
                            },
                        },
                    },
                },
            ]),
            DealActivity.countDocuments({
                createdAt: { $gte: monthStart, $lte: monthEnd },
                ...scopeFilter(req.user, "createdBy"),
            }),
            Client.countDocuments({ isActive: true, ...repScope }),
            Lead.find({ stage: { $nin: ["won", "lost"] }, ...scope })
                .sort({ value: -1 })
                .limit(5)
                .populate("owner", "fullName")
                .select("companyName dealName value currency probability stage owner")
                .lean(),
        ]);

        const wonRevenue = await Lead.aggregate([
            {
                $match: {
                    stage: "won",
                    closedAt: { $gte: monthStart, $lte: monthEnd },
                    ...scope,
                },
            },
            { $group: { _id: null, total: { $sum: "$value" } } },
        ]);

        const pipeline = pipelineTotals[0] || { raw: 0, weighted: 0 };

        res.json({
            success: true,
            data: {
                contacts: contactCount,
                openDeals: openDealCount,
                wonThisMonth,
                lostThisMonth,
                wonRevenueThisMonth: wonRevenue[0]?.total || 0,
                pipeline: {
                    raw: pipeline.raw || 0,
                    weighted: Math.round((pipeline.weighted || 0) * 100) / 100,
                },
                activitiesThisMonth,
                clients: clientCount,
                topDeals,
            },
        });
    } catch (error) {
        console.error("dashboardStats error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// KPI SNAPSHOT (for external KPI engine)
// ============================================================
const kpiSnapshot = async (req, res) => {
    try {
        const { month, year } = req.query;
        const now = new Date();
        const m = month ? parseInt(month) : now.getMonth() + 1;
        const y = year ? parseInt(year) : now.getFullYear();

        const monthStart = new Date(y, m - 1, 1);
        const monthEnd = new Date(y, m, 0, 23, 59, 59);

        const rows = await Lead.aggregate([
            {
                $match: {
                    stage: "won",
                    closedAt: { $gte: monthStart, $lte: monthEnd },
                },
            },
            {
                $group: {
                    _id: "$owner",
                    wonRevenue: { $sum: "$value" },
                    wonCount: { $sum: 1 },
                },
            },
            {
                $lookup: {
                    from: "dealactivities",
                    let: { ownerId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$createdBy", "$$ownerId"] },
                                createdAt: { $gte: monthStart, $lte: monthEnd },
                            },
                        },
                        { $count: "total" },
                    ],
                    as: "acts",
                },
            },
            {
                $project: {
                    _id: 0,
                    userId: "$_id",
                    wonRevenue: 1,
                    wonCount: 1,
                    activityCount: {
                        $ifNull: [{ $arrayElemAt: ["$acts.total", 0] }, 0],
                    },
                    month: m,
                    year: y,
                },
            },
        ]);

        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("kpiSnapshot error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    forecast,
    leaderboard,
    pipelineSummary,
    dashboardStats,
    kpiSnapshot,
};