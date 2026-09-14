// src/services/crm/forecast.service.js
const Lead = require("../../models/Lead.model");

/**
 * Weighted forecast by month.
 * Groups non-terminal deals by expectedCloseDate's month and sums
 * value × probability / 100.
 */
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

/**
 * Sales leaderboard: won revenue + won count + activity count per rep
 * for the given month window.
 */
async function getLeaderboard({ month, year } = {}) {
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
        as: "activityStats",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        fullName: "$user.fullName",
        email: "$user.email",
        wonRevenue: 1,
        wonCount: 1,
        activities: {
          $ifNull: [{ $arrayElemAt: ["$activityStats.total", 0] }, 0],
        },
      },
    },
    { $sort: { wonRevenue: -1 } },
  ]);

  return { month: m, year: y, rows };
}

module.exports = { getWeightedForecast, getLeaderboard };