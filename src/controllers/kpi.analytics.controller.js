// controllers/kpi.analytics.controller.js
const { KPIScore } = require("../models/KPIScore.model");
const { KPIWeight } = require("../models/KPIWeight.model");
const { User } = require("../models/User.model");
const { Department } = require("../models/Department.model");
const { Task } = require("../models/Task.model");
const mongoose = require("mongoose");

// ============================================================
// AI-POWERED INSIGHTS
// ============================================================
const getAIInsights = async (req, res) => {
  try {
    const { departmentId, month, year } = req.query;
    const user = req.user;

    const monthIndex = parseInt(month) || new Date().getMonth() + 1;
    const yearNum = parseInt(year) || new Date().getFullYear();
    const monthStr = `${yearNum}-${String(monthIndex).padStart(2, "0")}`;

    // Build query
    let query = { month: monthStr, year: yearNum };
    if (departmentId && departmentId !== "all") {
      query.departmentId = departmentId;
    }

    // Get scores
    const scores = await KPIScore.find(query)
      .populate("userId", "fullName email employeeId")
      .populate("departmentId", "name code")
      .lean();

    if (scores.length === 0) {
      return res.json({
        success: true,
        data: {
          insights: [
            {
              type: "info",
              title: "No Data Available",
              description:
                "No KPI data found for the selected period. Please calculate KPI scores first.",
              impact: "medium",
            },
          ],
          predictions: [],
          recommendations: [],
          anomalies: [],
          summary: {
            totalEmployees: 0,
            averageScore: 0,
            maxScore: 0,
            minScore: 0,
            stdDev: 0,
            distribution: {
              excellent: 0,
              good: 0,
              average: 0,
              needs_improvement: 0,
            },
          },
          departmentStats: [],
        },
      });
    }

    // Calculate statistics
    const total = scores.length;
    const avgScore = scores.reduce((sum, s) => sum + s.totalScore, 0) / total;
    const maxScore = Math.max(...scores.map((s) => s.totalScore));
    const minScore = Math.min(...scores.map((s) => s.totalScore));
    const stdDev = calculateStdDev(scores.map((s) => s.totalScore));

    // Department comparisons
    const deptMap = new Map();
    scores.forEach((s) => {
      const deptId = s.departmentId?._id?.toString() || "unknown";
      if (!deptMap.has(deptId)) {
        deptMap.set(deptId, {
          name: s.departmentId?.name || "Unknown",
          scores: [],
          total: 0,
          count: 0,
        });
      }
      const dept = deptMap.get(deptId);
      dept.scores.push(s.totalScore);
      dept.total += s.totalScore;
      dept.count++;
    });

    const deptStats = Array.from(deptMap.entries()).map(function (item) {
      const id = item[0];
      const data = item[1];
      return {
        departmentId: id,
        departmentName: data.name,
        averageScore: Math.round(data.total / data.count),
        employeeCount: data.count,
        minScore: Math.min.apply(null, data.scores),
        maxScore: Math.max.apply(null, data.scores),
        stdDev: calculateStdDev(data.scores),
      };
    });

    // Generate Insights
    const insights = generateInsights(
      scores,
      avgScore,
      maxScore,
      minScore,
      stdDev,
      deptStats,
    );

    // Generate Predictions
    const predictions = await generatePredictions(scores, departmentId);

    // Generate Recommendations
    const recommendations = generateRecommendations(
      scores,
      avgScore,
      deptStats,
    );

    // Detect Anomalies
    const anomalies = detectAnomalies(scores, avgScore, stdDev);

    res.json({
      success: true,
      data: {
        insights: insights,
        predictions: predictions,
        recommendations: recommendations,
        anomalies: anomalies,
        summary: {
          totalEmployees: total,
          averageScore: Math.round(avgScore),
          maxScore: Math.round(maxScore),
          minScore: Math.round(minScore),
          stdDev: Math.round(stdDev * 100) / 100,
          distribution: {
            excellent: scores.filter(function (s) {
              return s.performanceLevel === "excellent";
            }).length,
            good: scores.filter(function (s) {
              return s.performanceLevel === "good";
            }).length,
            average: scores.filter(function (s) {
              return s.performanceLevel === "average";
            }).length,
            needs_improvement: scores.filter(function (s) {
              return s.performanceLevel === "needs_improvement";
            }).length,
          },
        },
        departmentStats: deptStats,
      },
    });
  } catch (error) {
    console.error("Get AI insights error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error: " + error.message });
  }
};

// ============================================================
// PERFORMANCE PREDICTIONS
// ============================================================
const getPerformancePredictions = async (req, res) => {
  try {
    const { departmentId, months = 6 } = req.query;
    const user = req.user;

    // Get historical data
    let query = {};
    if (departmentId && departmentId !== "all") {
      query.departmentId = departmentId;
    }

    const historicalScores = await KPIScore.find(query)
      .sort({ year: 1, month: 1 })
      .lean();

    if (historicalScores.length === 0) {
      return res.json({
        success: true,
        data: {
          predictions: [],
          trend: "stable",
          confidence: 0,
        },
      });
    }

    // Group by month
    const monthData = new Map();
    historicalScores.forEach(function (s) {
      const key = s.year + "-" + s.month;
      if (!monthData.has(key)) {
        monthData.set(key, { scores: [], month: s.month, year: s.year });
      }
      monthData.get(key).scores.push(s.totalScore);
    });

    // Calculate monthly averages
    const monthlyAverages = Array.from(monthData.entries())
      .map(function (item) {
        const key = item[0];
        const data = item[1];
        return {
          month: data.month,
          year: data.year,
          average:
            data.scores.reduce(function (sum, s) {
              return sum + s;
            }, 0) / data.scores.length,
          count: data.scores.length,
        };
      })
      .sort(function (a, b) {
        return a.year - b.year || a.month - b.month;
      });

    // Simple linear regression for prediction
    const predictions = predictFutureScores(monthlyAverages, parseInt(months));

    // Determine trend
    const trend = determineTrend(monthlyAverages);

    // Calculate confidence
    const confidence = calculateConfidence(monthlyAverages);

    res.json({
      success: true,
      data: {
        predictions: predictions,
        trend: trend,
        confidence: confidence,
        historicalData: monthlyAverages,
      },
    });
  } catch (error) {
    console.error("Get performance predictions error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error: " + error.message });
  }
};

// ============================================================
// DEPARTMENT COMPARISONS
// ============================================================
const getDepartmentComparisons = async (req, res) => {
  try {
    const { month, year } = req.query;
    const monthIndex = parseInt(month) || new Date().getMonth() + 1;
    const yearNum = parseInt(year) || new Date().getFullYear();
    const monthStr = yearNum + "-" + String(monthIndex).padStart(2, "0");

    // Get all departments
    const departments = await Department.find({ isActive: true }).lean();

    // Get scores for each department
    const deptComparisons = await Promise.all(
      departments.map(async function (dept) {
        const scores = await KPIScore.find({
          departmentId: dept._id,
          month: monthStr,
          year: yearNum,
        })
          .populate("userId", "fullName email")
          .lean();

        const total = scores.length;
        const avg =
          total > 0
            ? scores.reduce(function (sum, s) {
                return sum + s.totalScore;
              }, 0) / total
            : 0;
        const max =
          total > 0
            ? Math.max.apply(
                null,
                scores.map(function (s) {
                  return s.totalScore;
                }),
              )
            : 0;
        const min =
          total > 0
            ? Math.min.apply(
                null,
                scores.map(function (s) {
                  return s.totalScore;
                }),
              )
            : 0;

        // Component averages
        const components = {
          taskCompletion:
            total > 0
              ? scores.reduce(function (sum, s) {
                  return sum + s.scores.taskCompletion.score;
                }, 0) / total
              : 0,
          qualityScore:
            total > 0
              ? scores.reduce(function (sum, s) {
                  return sum + s.scores.qualityScore.score;
                }, 0) / total
              : 0,
          efficiency:
            total > 0
              ? scores.reduce(function (sum, s) {
                  return sum + s.scores.efficiency.score;
                }, 0) / total
              : 0,
          collaboration:
            total > 0
              ? scores.reduce(function (sum, s) {
                  return sum + s.scores.collaboration.score;
                }, 0) / total
              : 0,
          innovation:
            total > 0
              ? scores.reduce(function (sum, s) {
                  return sum + s.scores.innovation.score;
                }, 0) / total
              : 0,
          attendance:
            total > 0
              ? scores.reduce(function (sum, s) {
                  return sum + s.scores.attendance.score;
                }, 0) / total
              : 0,
        };

        // Performance distribution
        const distribution = {
          excellent: scores.filter(function (s) {
            return s.performanceLevel === "excellent";
          }).length,
          good: scores.filter(function (s) {
            return s.performanceLevel === "good";
          }).length,
          average: scores.filter(function (s) {
            return s.performanceLevel === "average";
          }).length,
          needs_improvement: scores.filter(function (s) {
            return s.performanceLevel === "needs_improvement";
          }).length,
        };

        return {
          departmentId: dept._id,
          departmentName: dept.name,
          departmentCode: dept.code,
          totalEmployees: total,
          averageScore: Math.round(avg),
          maxScore: Math.round(max),
          minScore: Math.round(min),
          components: {
            taskCompletion: Math.round(components.taskCompletion),
            qualityScore: Math.round(components.qualityScore),
            efficiency: Math.round(components.efficiency),
            collaboration: Math.round(components.collaboration),
            innovation: Math.round(components.innovation),
            attendance: Math.round(components.attendance),
          },
          distribution: distribution,
        };
      }),
    );

    // Calculate overall stats
    const overall = {
      totalEmployees: deptComparisons.reduce(function (sum, d) {
        return sum + d.totalEmployees;
      }, 0),
      averageScore:
        deptComparisons.length > 0
          ? Math.round(
              deptComparisons.reduce(function (sum, d) {
                return sum + d.averageScore;
              }, 0) / deptComparisons.length,
            )
          : 0,
    };

    res.json({
      success: true,
      data: {
        departments: deptComparisons,
        overall: overall,
      },
    });
  } catch (error) {
    console.error("Get department comparisons error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error: " + error.message });
  }
};

// ============================================================
// HEAT MAP DATA
// ============================================================
const getHeatMapData = async (req, res) => {
  try {
    const { departmentId, month, year } = req.query;
    const monthIndex = parseInt(month) || new Date().getMonth() + 1;
    const yearNum = parseInt(year) || new Date().getFullYear();
    const monthStr = yearNum + "-" + String(monthIndex).padStart(2, "0");

    let query = { month: monthStr, year: yearNum };
    if (departmentId && departmentId !== "all") {
      query.departmentId = departmentId;
    }

    const scores = await KPIScore.find(query)
      .populate("userId", "fullName email employeeId")
      .populate("departmentId", "name code")
      .lean();

    // Generate heat map data
    const heatMapData = scores.map(function (score) {
      return {
        employeeId: score.userId._id,
        employeeName: score.userId.fullName,
        department: score.departmentId?.name || "Unknown",
        taskCompletion: score.scores.taskCompletion.score,
        qualityScore: score.scores.qualityScore.score,
        efficiency: score.scores.efficiency.score,
        collaboration: score.scores.collaboration.score,
        innovation: score.scores.innovation.score,
        attendance: score.scores.attendance.score,
        totalScore: score.totalScore,
        performanceLevel: score.performanceLevel,
      };
    });

    // Calculate component ranges for normalization
    const ranges = {
      taskCompletion: { min: 0, max: 100 },
      qualityScore: { min: 0, max: 100 },
      efficiency: { min: 0, max: 100 },
      collaboration: { min: 0, max: 100 },
      innovation: { min: 0, max: 100 },
      attendance: { min: 0, max: 100 },
    };

    res.json({
      success: true,
      data: {
        heatMapData: heatMapData,
        ranges: ranges,
        summary: {
          totalEmployees: scores.length,
          averageTotalScore:
            scores.length > 0
              ? Math.round(
                  scores.reduce(function (sum, s) {
                    return sum + s.totalScore;
                  }, 0) / scores.length,
                )
              : 0,
        },
      },
    });
  } catch (error) {
    console.error("Get heat map data error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error: " + error.message });
  }
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function calculateStdDev(values) {
  if (values.length === 0) return 0;
  var avg =
    values.reduce(function (sum, v) {
      return sum + v;
    }, 0) / values.length;
  var squareDiffs = values.map(function (v) {
    return Math.pow(v - avg, 2);
  });
  return Math.sqrt(
    squareDiffs.reduce(function (sum, v) {
      return sum + v;
    }, 0) / values.length,
  );
}

function generateInsights(
  scores,
  avgScore,
  maxScore,
  minScore,
  stdDev,
  deptStats,
) {
  var insights = [];

  // Overall performance insight
  if (avgScore >= 80) {
    insights.push({
      type: "success",
      title: "Strong Overall Performance",
      description:
        "The average score of " +
        Math.round(avgScore) +
        "% indicates strong performance across the organization.",
      impact: "high",
    });
  } else if (avgScore >= 60) {
    insights.push({
      type: "warning",
      title: "Moderate Performance Level",
      description:
        "The average score of " +
        Math.round(avgScore) +
        "% suggests room for improvement in key areas.",
      impact: "medium",
    });
  } else {
    insights.push({
      type: "danger",
      title: "Performance Improvement Needed",
      description:
        "The average score of " +
        Math.round(avgScore) +
        "% indicates significant performance gaps that need attention.",
      impact: "high",
    });
  }

  // Top performer insight
  if (maxScore > 0) {
    var topPerformer = scores.find(function (s) {
      return s.totalScore === maxScore;
    });
    insights.push({
      type: "success",
      title: "Top Performer Identified",
      description:
        (topPerformer?.userId?.fullName || "An employee") +
        " achieved the highest score of " +
        Math.round(maxScore) +
        "%",
      impact: "medium",
    });
  }

  // Low performer insight
  if (minScore < 40) {
    var lowPerformer = scores.find(function (s) {
      return s.totalScore === minScore;
    });
    insights.push({
      type: "danger",
      title: "Performance Alert",
      description:
        (lowPerformer?.userId?.fullName || "An employee") +
        " has a score of " +
        Math.round(minScore) +
        "% - below the target threshold.",
      impact: "high",
    });
  }

  // Consistency insight
  if (stdDev < 10) {
    insights.push({
      type: "info",
      title: "Consistent Performance",
      description:
        "Low variability in scores indicates consistent performance across the team.",
      impact: "low",
    });
  } else if (stdDev > 20) {
    insights.push({
      type: "warning",
      title: "Performance Variance",
      description:
        "High variability in scores suggests inconsistent performance that may need standardization.",
      impact: "medium",
    });
  }

  // Department comparison insight
  if (deptStats.length > 1) {
    var sorted = [...deptStats].sort(function (a, b) {
      return b.averageScore - a.averageScore;
    });
    var best = sorted[0];
    var worst = sorted[sorted.length - 1];
    if (best && worst && best.averageScore - worst.averageScore > 10) {
      insights.push({
        type: "info",
        title: "Department Performance Gap",
        description:
          best.departmentName +
          " (" +
          best.averageScore +
          "%) outperforms " +
          worst.departmentName +
          " (" +
          worst.averageScore +
          "%) by " +
          (best.averageScore - worst.averageScore) +
          "%",
        impact: "medium",
      });
    }
  }

  return insights;
}

function generatePredictions(scores, departmentId) {
  return new Promise(function (resolve) {
    try {
      // Simple moving average prediction
      var lastMonth = scores.slice(-3);
      var avgScore =
        lastMonth.reduce(function (sum, s) {
          return sum + s.totalScore;
        }, 0) / lastMonth.length;
      var trend =
        scores.slice(-6).reduce(function (sum, s, i, arr) {
          if (i === 0) return 0;
          return sum + (s.totalScore - arr[i - 1].totalScore);
        }, 0) /
        (scores.length - 1);

      var predictions = [];
      var months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      var nextMonth = new Date().getMonth() + 1;

      for (var i = 0; i < 6; i++) {
        var predicted = Math.max(0, Math.min(100, avgScore + trend * (i + 1)));
        var monthIdx = (nextMonth + i) % 12;
        predictions.push({
          month: months[monthIdx],
          predictedScore: Math.round(predicted),
          confidence: predictions.length < 3 ? "medium" : "high",
          trend: trend > 2 ? "up" : trend < -2 ? "down" : "stable",
        });
      }

      resolve(predictions);
    } catch (error) {
      console.error("Generate predictions error:", error);
      resolve([]);
    }
  });
}

function generateRecommendations(scores, avgScore, deptStats) {
  var recommendations = [];

  // Overall recommendations
  if (avgScore < 70) {
    recommendations.push({
      area: "Overall Performance",
      title: "Improve Overall Performance",
      description:
        "Focus on training and development programs to improve key performance areas.",
      priority: "high",
      impact: "high",
    });
  }

  // Component-specific recommendations
  var componentAverages = {
    taskCompletion:
      scores.reduce(function (sum, s) {
        return sum + s.scores.taskCompletion.score;
      }, 0) / scores.length,
    qualityScore:
      scores.reduce(function (sum, s) {
        return sum + s.scores.qualityScore.score;
      }, 0) / scores.length,
    efficiency:
      scores.reduce(function (sum, s) {
        return sum + s.scores.efficiency.score;
      }, 0) / scores.length,
    collaboration:
      scores.reduce(function (sum, s) {
        return sum + s.scores.collaboration.score;
      }, 0) / scores.length,
    innovation:
      scores.reduce(function (sum, s) {
        return sum + s.scores.innovation.score;
      }, 0) / scores.length,
    attendance:
      scores.reduce(function (sum, s) {
        return sum + s.scores.attendance.score;
      }, 0) / scores.length,
  };

  var componentNames = {
    taskCompletion: "Task Completion",
    qualityScore: "Quality Score",
    efficiency: "Efficiency",
    collaboration: "Collaboration",
    innovation: "Innovation",
    attendance: "Attendance",
  };

  Object.keys(componentAverages).forEach(function (key) {
    var value = componentAverages[key];
    if (value < 60) {
      recommendations.push({
        area: componentNames[key] || key,
        title: "Improve " + (componentNames[key] || key),
        description:
          "Current " +
          (componentNames[key] || key) +
          " score is " +
          Math.round(value) +
          "%. Implement targeted improvement strategies.",
        priority: value < 40 ? "high" : "medium",
        impact: "medium",
      });
    }
  });

  // Department recommendations
  if (deptStats.length > 1) {
    var sorted = [...deptStats].sort(function (a, b) {
      return b.averageScore - a.averageScore;
    });
    var worst = sorted[sorted.length - 1];
    if (worst && worst.averageScore < 60) {
      recommendations.push({
        area: "Department Performance",
        title: "Support " + worst.departmentName,
        description:
          worst.departmentName +
          " (" +
          worst.averageScore +
          "%) needs additional support and resources to improve performance.",
        priority: "high",
        impact: "high",
      });
    }
  }

  return recommendations;
}

function detectAnomalies(scores, avgScore, stdDev) {
  var anomalies = [];
  var threshold = 2;

  scores.forEach(function (score) {
    var zScore = (score.totalScore - avgScore) / stdDev;
    if (Math.abs(zScore) > threshold) {
      anomalies.push({
        employeeId: score.userId._id,
        employeeName: score.userId.fullName,
        department: score.departmentId?.name || "Unknown",
        score: score.totalScore,
        expectedScore: Math.round(avgScore),
        deviation: Math.round(zScore * 100) / 100,
        type: zScore > 0 ? "high_performer" : "low_performer",
        severity: Math.abs(zScore) > 3 ? "critical" : "high",
      });
    }
  });

  return anomalies;
}

function predictFutureScores(monthlyAverages, months) {
  if (monthlyAverages.length < 2) {
    return [];
  }

  var predictions = [];
  var lastData = monthlyAverages[monthlyAverages.length - 1];
  var trend =
    (monthlyAverages[monthlyAverages.length - 1].average -
      monthlyAverages[0].average) /
    (monthlyAverages.length - 1);

  for (var i = 0; i < months; i++) {
    predictions.push({
      month: i + 1,
      predictedScore: Math.max(
        0,
        Math.min(100, Math.round(lastData.average + trend * (i + 1))),
      ),
    });
  }

  return predictions;
}

function determineTrend(monthlyAverages) {
  if (monthlyAverages.length < 2) return "stable";

  var first = monthlyAverages[0].average;
  var last = monthlyAverages[monthlyAverages.length - 1].average;
  var diff = last - first;
  var percentChange = (diff / first) * 100;

  if (percentChange > 5) return "up";
  if (percentChange < -5) return "down";
  return "stable";
}

function calculateConfidence(monthlyAverages) {
  if (monthlyAverages.length < 3) return 0.3;
  if (monthlyAverages.length < 6) return 0.6;
  return 0.85;
}

// ============================================================
// EXPORT
// ============================================================
module.exports = {
  getAIInsights,
  getPerformancePredictions,
  getDepartmentComparisons,
  getHeatMapData,
};
