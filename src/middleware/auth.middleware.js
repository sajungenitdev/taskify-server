const jwt = require("jsonwebtoken");
const { User } = require("../models/User.model");

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ success: false, message: "User not found or inactive" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Super admin has access to everything
    if (req.user.role === "super_admin") {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(", ")}`,
      });
    }
    next();
  };
};

const requireMinRole = (minRole) => {
  const roleHierarchy = {
    employee: 1,
    line_manager: 2,
    project_manager: 3,
    dept_manager: 4,
    hr_manager: 5,
    admin: 6,
    super_admin: 7,
  };

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Super admin has access to everything
    if (req.user.role === "super_admin") {
      return next();
    }

    const userLevel = roleHierarchy[req.user.role] || 0;
    const requiredLevel = roleHierarchy[minRole] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Minimum role required: ${minRole}`,
      });
    }
    next();
  };
};

module.exports = { authenticate, requireRole, requireMinRole };
