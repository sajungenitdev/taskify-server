// controllers/auditLog.controller.js
const { AuditLog } = require("../models/AuditLog.model");

// ============================================================
// GET AUDIT LOGS
// ============================================================
const getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      action = "",
      resource = "",
      status = "",
      severity = "",
      userId = "",
      dateFrom = "",
      dateTo = "",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build filter
    const filter = {};

    if (action) filter.action = action;
    if (resource) filter.resource = resource;
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (userId) filter.userId = userId;

    // Date range
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    // Search
    if (search) {
      filter.$or = [
        { "user.name": { $regex: search, $options: "i" } },
        { "user.email": { $regex: search, $options: "i" } },
        { action: { $regex: search, $options: "i" } },
        { resource: { $regex: search, $options: "i" } },
        { ip: { $regex: search, $options: "i" } },
      ];
    }

    // Get logs
    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await AuditLog.countDocuments(filter);

    // Get stats
    const stats = await AuditLog.getStats(filter);

    res.json({
      success: true,
      data: {
        logs,
        stats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// ============================================================
// GET AUDIT LOG STATS
// ============================================================
const getAuditLogStats = async (req, res) => {
  try {
    const stats = await AuditLog.getStats({});
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Get audit log stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// ============================================================
// GET AUDIT LOG BY ID
// ============================================================
const getAuditLogById = async (req, res) => {
  try {
    const { id } = req.params;
    const log = await AuditLog.findById(id);
    if (!log) {
      return res.status(404).json({
        success: false,
        message: "Audit log not found",
      });
    }
    res.json({
      success: true,
      data: log,
    });
  } catch (error) {
    console.error("Get audit log by id error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// ============================================================
// EXPORT AUDIT LOGS
// ============================================================
const exportAuditLogs = async (req, res) => {
  try {
    const {
      search = "",
      action = "",
      resource = "",
      status = "",
      severity = "",
      userId = "",
      dateFrom = "",
      dateTo = "",
    } = req.query;

    // Build filter
    const filter = {};

    if (action) filter.action = action;
    if (resource) filter.resource = resource;
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (userId) filter.userId = userId;

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    if (search) {
      filter.$or = [
        { "user.name": { $regex: search, $options: "i" } },
        { "user.email": { $regex: search, $options: "i" } },
        { action: { $regex: search, $options: "i" } },
        { resource: { $regex: search, $options: "i" } },
      ];
    }

    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(10000);

    // Convert to CSV
    const headers = [
      "Timestamp", "User", "Email", "Action", "Resource",
      "Resource ID", "Status", "Severity", "IP", "Location",
      "Device", "Browser", "OS", "Details"
    ];

    const rows = logs.map(log => [
      log.createdAt.toISOString(),
      log.user.name,
      log.user.email,
      log.action,
      log.resource,
      log.resourceId || "",
      log.status,
      log.severity,
      log.ip,
      log.location || "",
      log.device || "",
      log.metadata?.browser || "",
      log.metadata?.os || "",
      JSON.stringify(log.details),
    ]);

    const csv = [
      headers.join(","),
      ...rows.map(row => row.join(",")),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=audit-logs-${new Date().toISOString().split("T")[0]}.csv`
    );
    res.send(csv);
  } catch (error) {
    console.error("Export audit logs error:", error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

// ============================================================
// CREATE AUDIT LOG (Middleware Helper)
// ============================================================
// controllers/auditLog.controller.js - Fix the createAuditLog function

const createAuditLog = async (data) => {
  try {
    // ✅ Ensure user.name is always set
    const logData = {
      ...data,
      user: {
        id: data.user?.id || data.userId || null,
        name: data.user?.name || data.user?.fullName || data.user?.email || "System",
        email: data.user?.email || "unknown@system.com",
        role: data.user?.role || "system",
      },
      // Ensure required fields have defaults
      action: data.action || "unknown",
      resource: data.resource || "system",
      ip: data.ip || req?.ip || "0.0.0.0",
      userAgent: data.userAgent || "Unknown",
    };

    const log = new AuditLog(logData);
    await log.save();
    return log;
  } catch (error) {
    console.error("Create audit log error:", error);
    // Don't throw - just log the error
    return null;
  }
};

module.exports = {
  getAuditLogs,
  getAuditLogStats,
  getAuditLogById,
  exportAuditLogs,
  createAuditLog,
};