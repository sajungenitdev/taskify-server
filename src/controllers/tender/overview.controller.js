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

/* ============================================================
 * PERFORMANCE — last 6 months won vs lost
 * GET /api/v1/tenders/overview/performance
 * ============================================================ */
const performance = async (_req, res) => {
  try {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 1),
        label: d.toLocaleString("en-US", { month: "short" }),
      });
    }

    const agg = await Tender.aggregate([
      {
        $match: {
          stage: { $in: ["won", "lost"] },
          updatedAt: { $gte: months[0].start },
        },
      },
      {
        $group: {
          _id: {
            stage: "$stage",
            year: { $year: "$updatedAt" },
            month: { $month: "$updatedAt" },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const data = months.map((m) => {
      const year = m.start.getFullYear();
      const month = m.start.getMonth() + 1;
      const won =
        agg.find(
          (a) => a._id.stage === "won" && a._id.year === year && a._id.month === month
        )?.count ?? 0;
      const lost =
        agg.find(
          (a) => a._id.stage === "lost" && a._id.year === year && a._id.month === month
        )?.count ?? 0;
      return { month: m.label, won, lost };
    });

    const totalWon = data.reduce((s, d) => s + d.won, 0);
    const totalLost = data.reduce((s, d) => s + d.lost, 0);
    const winRate =
      totalWon + totalLost > 0
        ? Math.round((totalWon / (totalWon + totalLost)) * 100)
        : 0;

    res.json({ success: true, data: { data, winRate } });
  } catch (error) {
    console.error("performance error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * RECENT ACTIVITY — latest stage changes across tenders
 * GET /api/v1/tenders/overview/recent-activity?limit=10
 * ============================================================ */
const recentActivity = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const tenders = await Tender.find({})
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select("tenderer title stage updatedAt advertisementFile")
      .lean();

    const items = tenders.map((t) => {
      let kind = "uploaded";
      let message = "";

      if (t.stage === "submitted") {
        kind = "submitted";
        message = `${t.title} — submitted, awaiting result`;
      } else if (t.stage === "won") {
        kind = "won";
        message = `${t.title} — won`;
      } else if (t.stage === "lost") {
        kind = "lost";
        message = `${t.title} — lost`;
      } else if (t.advertisementFile) {
        kind = "uploaded";
        message = `${t.title} — advertisement uploaded`;
      } else {
        kind = "discussed";
        message = `${t.title} — under discussion`;
      }

      return {
        id: String(t._id),
        kind,
        tenderer: t.tenderer,
        message,
        timeAgo: timeAgo(t.updatedAt),
      };
    });

    res.json({ success: true, data: items });
  } catch (error) {
    console.error("recentActivity error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ---------- helper ---------- */
function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

module.exports = { overview, upcomingDeadlines, performance, recentActivity };