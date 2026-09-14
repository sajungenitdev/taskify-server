// src/services/crm/forecast.service.js
const mongoose = require("mongoose");
const Lead = require("../../models/Lead.model");
const DealActivity = require("../../models/DealActivity.model");
const User = require("../../models/User.model");

/* ============================================================================
 * WEIGHTED FORECAST
 * Groups non-terminal deals by expectedCloseDate's month and sums
 * value × probability / 100.
 * ========================================================================== */
async function getWeightedForecast({ from, to, ownerId } = {}) {
  const match = {
    stage: { $nin: ["won", "lost"] },
  };

  if (ownerId) match.owner = ownerId;

  if (from || to) {
    match.expectedCloseDate = {};
    if (from) match.expectedCloseDate.$gte = new Date(from);
    if (to) match.expectedCloseDate.$lte = new Date(to);
  }

  const rows = await Lead.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          month: {
            $dateToString: { format: "%Y-%m", date: "$expectedCloseDate" },
          },
        },
        weighted: {
          $sum: {
            $multiply: [
              "$value",
              { $divide: [{ $ifNull: ["$probability", 0] }, 100] },
            ],
          },
        },
        raw: { $sum: "$value" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((r) => ({
    month: r._id.month,
    weighted: Math.round(r.weighted * 100) / 100,
    raw: r.raw,
    count: r.count,
  }));
}

/* ============================================================================
 * LEADERBOARD
 *
 * Lists every rep who either:
 *   - won at least one deal whose `closedAt` falls in the selected month, OR
 *   - logged at least one DealActivity in the selected month
 *
 * For each rep we return:
 *   - wonRevenue  (sum of value of won deals that month)
 *   - wonCount    (count of won deals that month)
 *   - activities  (count of DealActivity entries created by the rep that month)
 *
 * Sort priority:
 *   1) wonRevenue DESC
 *   2) activities DESC
 * ========================================================================== */
async function getLeaderboard({ month, year } = {}) {
  const now = new Date();
  const m = month ? parseInt(month, 10) : now.getMonth() + 1;
  const y = year ? parseInt(year, 10) : now.getFullYear();

  // Inclusive boundaries — the last day of the month at 23:59:59.999
  const monthStart = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);

  // 1) Collect owner ids from both sources
  const [wonOwnerAgg, activityOwnerAgg] = await Promise.all([
    Lead.aggregate([
      {
        $match: {
          stage: "won",
          closedAt: { $gte: monthStart, $lte: monthEnd },
        },
      },
      { $group: { _id: "$owner" } },
    ]),
    DealActivity.aggregate([
      {
        $match: {
          createdAt: { $gte: monthStart, $lte: monthEnd },
        },
      },
      { $group: { _id: "$createdBy" } },
    ]),
  ]);

  const ownerIdsSet = new Set();
  for (const r of wonOwnerAgg) {
    if (r._id) ownerIdsSet.add(String(r._id));
  }
  for (const r of activityOwnerAgg) {
    if (r._id) ownerIdsSet.add(String(r._id));
  }

  const ownerIds = Array.from(ownerIdsSet)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (ownerIds.length === 0) {
    return { month: m, year: y, rows: [] };
  }

  // 2) Won revenue + count per owner (this month)
  const wonAgg = await Lead.aggregate([
    {
      $match: {
        stage: "won",
        owner: { $in: ownerIds },
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
  ]);
  const wonMap = new Map(wonAgg.map((r) => [String(r._id), r]));

  // 3) Activity count per owner (this month)
  const activityAgg = await DealActivity.aggregate([
    {
      $match: {
        createdBy: { $in: ownerIds },
        createdAt: { $gte: monthStart, $lte: monthEnd },
      },
    },
    { $group: { _id: "$createdBy", total: { $sum: 1 } } },
  ]);
  const activityMap = new Map(
    activityAgg.map((r) => [String(r._id), r.total]),
  );

  // 4) Load user info in one query
  const users = await User.find({ _id: { $in: ownerIds } })
    .select("_id fullName email")
    .lean();
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  // 5) Compose + sort rows
  const rows = ownerIds
    .map((id) => {
      const key = String(id);
      const u = userMap.get(key);
      const w = wonMap.get(key);
      return {
        userId: id,
        fullName: u?.fullName ?? "Unknown User",
        email: u?.email ?? "",
        wonRevenue: w?.wonRevenue ?? 0,
        wonCount: w?.wonCount ?? 0,
        activities: activityMap.get(key) ?? 0,
      };
    })
    .sort((a, b) => {
      if (b.wonRevenue !== a.wonRevenue) return b.wonRevenue - a.wonRevenue;
      return b.activities - a.activities;
    });

  return { month: m, year: y, rows };
}

module.exports = { getWeightedForecast, getLeaderboard };