const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

dotenv.config();

const app = express();

// ==================== RATE LIMITING ====================
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === "production" ? 100 : 1000,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
  skip: (req) => {
    if (process.env.NODE_ENV === "development") {
      const ip = req.ip || req.connection.remoteAddress;
      return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
    }
    return false;
  },
});

// ==================== MIDDLEWARE ====================
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
// In server.js
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:5000",
        "http://localhost:3001",
        "https://taskify-frontend-alpha.vercel.app",
        "https://taskify-server-5gat.onrender.com",
        undefined,
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log(`CORS blocked: ${origin}`);
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "X-Request-ID", // ✅ ADD THIS - allow custom header
      "Access-Control-Request-Method",
      "Access-Control-Request-Headers",
    ],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    maxAge: 600,
  }),
);

// Handle preflight requests
app.options("*", cors());
app.options("*", cors());
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(limiter);

// ==================== STATIC FILES ====================
const uploadsPath = path.join(__dirname, "uploads");
console.log(`📁 Uploads directory: ${uploadsPath}`);

// Create upload directories
const directories = [
  { path: uploadsPath, name: "uploads" },
  { path: path.join(uploadsPath, "tasks"), name: "tasks" },
  { path: path.join(uploadsPath, "avatars"), name: "avatars" },
  { path: path.join(uploadsPath, "signatures"), name: "signatures" }, // Added for leave signatures
];

for (const dir of directories) {
  if (!fs.existsSync(dir.path)) {
    fs.mkdirSync(dir.path, { recursive: true });
    console.log(`📁 Created ${dir.name} directory`);
  }
}

// Serve static files
app.use(
  "/uploads",
  express.static(uploadsPath, {
    setHeaders: (res, filePath) => {
      if (filePath.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
        res.setHeader(
          "Content-Type",
          `image/${path.extname(filePath).slice(1)}`,
        );
      }
      res.setHeader("Cache-Control", "public, max-age=31536000");
    },
  }),
);

// ==================== TEST ENDPOINTS ====================
app.get("/test-uploads", (req, res) => {
  try {
    const tasksPath = path.join(uploadsPath, "tasks");
    const files = fs.existsSync(tasksPath) ? fs.readdirSync(tasksPath) : [];
    res.json({
      success: true,
      message: "Uploads directory is accessible",
      uploadsPath: uploadsPath,
      tasksPath: tasksPath,
      filesCount: files.length,
      files: files.slice(0, 20),
      staticUrl: "/uploads/tasks/",
      serverUrl: `${req.protocol}://${req.get("host")}`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      uploadsPath: uploadsPath,
    });
  }
});

// ==================== ROUTES ====================
const authRoutes = require("./src/routes/auth.routes");
const userRoutes = require("./src/routes/user.routes");
const departmentRoutes = require("./src/routes/department.routes");
const taskRoutes = require("./src/routes/task.routes");
const projectRoutes = require("./src/routes/project.routes");
const resourceRoutes = require("./src/routes/resource.routes");
const templateRoutes = require("./src/routes/template.routes");
const roleRoutes = require("./src/routes/role.routes");
const notificationRoutes = require("./src/routes/notification.routes");
const performanceRoutes = require("./src/routes/performance.routes");
const aiRoutes = require("./src/routes/ai.routes");
const reportRoutes = require("./src/routes/report.routes");
const leaveRoutes = require("./src/routes/leave.routes");
const teamRoutes = require('./src/routes/team.routes');
const attendanceRoutes = require("./src/routes/attendance.routes");


// API Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/departments", departmentRoutes);
app.use("/api/v1/tasks", taskRoutes);
app.use("/api/v1/projects", projectRoutes);
app.use("/api/v1/resources", resourceRoutes);
app.use("/api/v1/templates", templateRoutes);
app.use("/api/v1/roles", roleRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/performance", performanceRoutes);
app.use("/api/v1/ai", aiRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/leaves", leaveRoutes);
app.use('/api/v1/teams', teamRoutes);
app.use("/api/attendance", attendanceRoutes);

// ==================== HEALTH CHECK ====================
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    mongodb:
      mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    uploadsDir: fs.existsSync(uploadsPath),
    endpoints: {
      tasks: "/api/v1/tasks",
      projects: "/api/v1/projects",
      resources: "/api/v1/resources",
      templates: "/api/v1/templates",
      departments: "/api/v1/departments",
      auth: "/api/v1/auth",
      users: "/api/v1/users",
      leaves: "/api/v1/leaves",
      testUploads: "/test-uploads",
    },
  });
});

// ==================== ROOT ENDPOINT ====================
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Enterprise Task Management API",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    endpoints: {
      auth: "/api/v1/auth",
      users: "/api/v1/users",
      departments: "/api/v1/departments",
      tasks: "/api/v1/tasks",
      projects: "/api/v1/projects",
      resources: "/api/v1/resources",
      templates: "/api/v1/templates",
      leaves: "/api/v1/leaves",
      health: "/health",
      testUploads: "/test-uploads",
    },
  });
});

// ==================== 404 HANDLER ====================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.url}`,
    timestamp: new Date().toISOString(),
  });
});

// ==================== GLOBAL ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  console.error("📚 Stack:", err.stack);

  const statusCode = err.status || 500;
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    success: false,
    message: message,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// ==================== DATABASE CONNECTION ====================
const connectDB = async (retries = 5, delay = 5000) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected successfully");
    return true;
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    if (retries > 0) {
      console.log(
        `Retrying in ${delay / 1000} seconds... (${retries} retries left)`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return connectDB(retries - 1, delay);
    }
    return false;
  }
};

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("         ENTERPRISE TASK MANAGEMENT SYSTEM");
  console.log("═══════════════════════════════════════════════════════════");

  const dbConnected = await connectDB();

  if (!dbConnected) {
    console.log("\n⚠️  Server starting without database connection");
  }

  // Log uploads directory status
  console.log(`\n📁 Uploads directory: ${uploadsPath}`);
  console.log(`📁 Uploads exists: ${fs.existsSync(uploadsPath)}`);
  console.log(
    `📁 Tasks uploads exists: ${fs.existsSync(path.join(uploadsPath, "tasks"))}`,
  );
  console.log(
    `📁 Avatars uploads exists: ${fs.existsSync(path.join(uploadsPath, "avatars"))}`,
  );
  console.log(
    `📁 Signatures uploads exists: ${fs.existsSync(path.join(uploadsPath, "signatures"))}`,
  );

  app.listen(PORT, () => {
    console.log(`\n📡 Server:          http://localhost:${PORT}`);
    console.log(`🌍 Environment:     ${process.env.NODE_ENV || "development"}`);
    console.log(
      `💾 Database:        ${dbConnected ? "Connected ✅" : "Disconnected ⚠️"}`,
    );
    console.log(`📁 Static files:    /uploads`);
    console.log(
      `🔐 Auth endpoint:   http://localhost:${PORT}/api/v1/auth/login`,
    );
    console.log(`📋 Tasks endpoint:  http://localhost:${PORT}/api/v1/tasks`);
    console.log(
      `📁 Projects endpoint: http://localhost:${PORT}/api/v1/projects`,
    );
    console.log(
      `📦 Resources endpoint: http://localhost:${PORT}/api/v1/resources`,
    );
    console.log(
      `📝 Templates endpoint: http://localhost:${PORT}/api/v1/templates`,
    );
    console.log(`📋 Leaves endpoint: http://localhost:${PORT}/api/v1/leaves`);
    console.log(`🧪 Test uploads:    http://localhost:${PORT}/test-uploads`);
    console.log(
      "\n═══════════════════════════════════════════════════════════\n",
    );

    // Start scheduled jobs
    try {
      const {
        startScheduledJobs,
      } = require("./src/services/notification.service");
      startScheduledJobs();
      console.log("✅ Notification scheduled jobs started");
    } catch (error) {
      console.error("⚠️ Failed to start scheduled jobs:", error.message);
    }
  });
};

// ==================== GRACEFUL SHUTDOWN ====================
const gracefulShutdown = async () => {
  console.log("\n\n🛑 Shutting down gracefully...");
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    console.log("📦 MongoDB connection closed");
  }
  process.exit(0);
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

// ==================== UNHANDLED REJECTIONS ====================
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise);
  console.error("📚 Reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  // Don't exit the process, just log the error
});

startServer();
