// src/controllers/tender/overview.controller.js
const Tender = require("../../models/Tender.model");

const overview = async (req, res) => {
  try {
    const [stageAgg, winLoss] = await Promise.all([
      Tender.aggregate([
        { $group: { _id: "$stage", count: { $sum: 1 }, total: { $sum: "$tentativeBudget" } } },
      ]),
      Tender.aggregate([
        {
          $match: {
            stage: { $in: ["won", "lost"] },
            updatedAt: { $gte: new Date(Date.now() - 365 * 86400000) },
          },
        },
        { $group: { _id: "$stage", count: { $sum: 1 } } },
      ]),
    ]);

    const byStage = stageAgg.reduce((acc, s) => {
      acc[s._id] = s.count;
      return acc;
    }, {});

    const wonCount = winLoss.find((w) => w._id === "won")?.count ?? 0;
    const lostCount = winLoss.find((w) => w._id === "lost")?.count ?? 0;
    const winRate =
      wonCount + lostCount > 0
        ? Math.round((wonCount / (wonCount + lostCount)) * 100)
        : 0;

    const totalTenders = Object.values(byStage).reduce((a, b) => a + b, 0);

    const totalBidValueAgg = await Tender.aggregate([
      { $match: { stage: "submitted" } },
      { $group: { _id: null, total: { $sum: "$bidValue" } } },
    ]);

    res.json({
      success: true,
      data: {
        stats: [
          {
            label: "Total Tenders (FY26)",
            value: String(totalTenders),
            hint: "Across all stages",
          },
          {
            label: "Currently Active",
            value: String(byStage.active ?? 0),
            hint: "Docs in preparation",
          },
          {
            label: "Awaiting Result",
            value: String(byStage.submitted ?? 0),
            hint: "Submitted, pending decision",
          },
          {
            label: "Win Rate (FY26)",
            value: `${winRate}%`,
            hint: `${wonCount} Won · ${lostCount} Lost`,
          },
          {
            label: "Total Bid Value",
            value: `৳${(totalBidValueAgg[0]?.total ?? 0).toLocaleString("en-IN")}`,
            hint: "Submitted this FY",
            highlighted: true,
          },
        ],
        pipeline: [
          { id: "potential", label: "Potential", count: byStage.potential ?? 0, color: "bg-slate-400", hint: "Under review" },
          { id: "active", label: "Active", count: byStage.active ?? 0, color: "bg-indigo-500", hint: "In preparation" },
          { id: "submitted", label: "Submitted", count: byStage.submitted ?? 0, color: "bg-amber-500", hint: "Awaiting result" },
          { id: "won", label: "Won", count: wonCount, color: "bg-emerald-500", hint: "This FY" },
          { id: "lost", label: "Lost", count: lostCount, color: "bg-rose-500", hint: "This FY" },
        ],
      },
    });
  } catch (error) {
    console.error("overview error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const upcomingDeadlines = async (_req, res) => {
  try {
    const rows = await Tender.find({
      stage: { $in: ["potential", "active"] },
      lastDateOfSubmission: { $gte: new Date() },
    })
      .sort({ lastDateOfSubmission: 1 })
      .limit(10)
      .lean();

    const data = rows.map((t) => ({
      id: t._id,
      tenderer: t.tenderer,
      title: t.title,
      daysLeft: Math.max(
        0,
        Math.ceil(
          (new Date(t.lastDateOfSubmission).getTime() - Date.now()) / 86400000
        )
      ),
      value: t.tentativeBudget
        ? `৳${t.tentativeBudget.toLocaleString("en-IN")}`
        : "—",
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error("upcomingDeadlines error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { overview, upcomingDeadlines };