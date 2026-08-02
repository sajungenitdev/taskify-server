// middleware/auditLog.middleware.js
const { createAuditLog } = require("../controllers/auditLog.controller");
const requestIp = require("request-ip");
const geoip = require("geoip-lite");

const auditLog = (options = {}) => {
  return async (req, res, next) => {
    // Store original send method
    const originalSend = res.send;
    const originalJson = res.json;

    // Capture response data
    let responseData = null;

    res.send = function(data) {
      responseData = data;
      return originalSend.call(this, data);
    };

    res.json = function(data) {
      responseData = data;
      return originalJson.call(this, data);
    };

    // Continue with request
    next();

    // After response is sent, create audit log
    res.on("finish", async () => {
      // Skip if no user (unauthenticated)
      if (!req.user) return;

      // Get IP
      const ip = requestIp.getClientIp(req) || req.ip || "Unknown";
      
      // Get location from IP
      const geo = geoip.lookup(ip);
      const location = geo ? `${geo.city}, ${geo.country}` : "Unknown";

      // Parse user agent
      const userAgent = req.headers["user-agent"] || "Unknown";
      const ua = require("ua-parser-js")(userAgent);

      // Determine status from response
      const statusCode = res.statusCode;
      let status = "success";
      let severity = "low";

      if (statusCode >= 400 && statusCode < 500) {
        status = "failed";
        severity = "medium";
      } else if (statusCode >= 500) {
        status = "failed";
        severity = "high";
      } else if (statusCode >= 300 && statusCode < 400) {
        status = "warning";
        severity = "medium";
      }

      // Determine action from route
      let action = "view";
      const method = req.method;
      if (method === "POST") action = "create";
      else if (method === "PUT" || method === "PATCH") action = "update";
      else if (method === "DELETE") action = "delete";
      else if (method === "GET") action = "view";

      // Determine resource from route
      const path = req.path;
      let resource = "unknown";
      if (path.includes("/users")) resource = "user";
      else if (path.includes("/roles")) resource = "role";
      else if (path.includes("/tasks")) resource = "task";
      else if (path.includes("/projects")) resource = "project";
      else if (path.includes("/teams")) resource = "team";
      else if (path.includes("/settings")) resource = "setting";
      else if (path.includes("/api-keys")) resource = "api";
      else if (path.includes("/audit")) resource = "audit";

      // Create log data
      const logData = {
        action: options.action || action,
        resource: options.resource || resource,
        resourceId: req.params.id || null,
        userId: req.user._id,
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
        },
        ip,
        userAgent,
        device: ua.device?.model || "Unknown",
        location,
        details: {
          method: req.method,
          path: req.path,
          query: req.query,
          body: req.body,
          params: req.params,
          statusCode,
          response: responseData,
          userAgent: req.headers["user-agent"],
        },
        status,
        severity: options.severity || severity,
        metadata: {
          browser: ua.browser?.name || "Unknown",
          os: ua.os?.name || "Unknown",
          platform: ua.os?.platform || "Unknown",
        },
      };

      // Create audit log asynchronously (don't wait for it)
      createAuditLog(logData).catch((err) => {
        console.error("Failed to create audit log:", err);
      });
    });
  };
};

module.exports = { auditLog };