const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const taskRoutes = require("./src/routes/task.routes");
const projectRoutes = require("./src/routes/project.routes");
const workflowRoutes = require('./src/routes/workflow.routes');
const templateRoutes = require('./src/routes/template.routes');
const resourceRoutes = require('./src/routes/resource.routes');



dotenv.config();

const app = express();

// Rate limiting - Skip for development
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === "production" ? 100 : 1000, // Higher limit for development
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
  skip: (req) => {
    // Skip rate limiting for localhost in development
    if (process.env.NODE_ENV === "development") {
      const ip = req.ip || req.connection.remoteAddress;
      return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
    }
    return false;
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === "production" ? 10 : 100,
  message: {
    success: false,
    message: "Too many attempts, please try again after a minute.",
  },
  skip: (req) => {
    if (process.env.NODE_ENV === "development") {
      const ip = req.ip || req.connection.remoteAddress;
      return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
    }
    return false;
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:5000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5000",
        undefined, // Allow same origin
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Content-Disposition"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  }),
);

app.options("*", cors());

// Static files for uploads with CORS headers
app.use(
  "/uploads",
  express.static("uploads", {
    setHeaders: (res, path) => {
      res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  }),
);

app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(limiter);

// Routes
const authRoutes = require("./src/routes/auth.routes");
const userRoutes = require("./src/routes/user.routes");
const departmentRoutes = require("./src/routes/department.routes");

// API Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/departments", departmentRoutes);
app.use("/api/v1/tasks", taskRoutes);
app.use('/api/v1/workflows', workflowRoutes);
app.use('/api/v1/templates', templateRoutes);
app.use("/api/v1/projects", projectRoutes);
app.use('/api/v1/resources', resourceRoutes);
// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Enterprise Task Management API",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    endpoints: {
      auth: {
        login: "POST /api/v1/auth/login",
        register: "POST /api/v1/auth/register",
        users: "GET /api/v1/auth/users",
        me: "GET /api/v1/auth/me",
      },
      departments: {
        list: "GET /api/v1/departments",
        create: "POST /api/v1/departments",
        getById: "GET /api/v1/departments/:id",
        update: "PUT /api/v1/departments/:id",
        delete: "DELETE /api/v1/departments/:id",
        employees: "GET /api/v1/departments/:id/employees",
      },
      tasks: {
        list: "GET /api/v1/tasks",
        myTasks: "GET /api/v1/tasks/my-tasks",
        create: "POST /api/v1/tasks",
        update: "PUT /api/v1/tasks/:id",
        delete: "DELETE /api/v1/tasks/:id",
      },
      health: "GET /health",
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.url}`,
    timestamp: new Date().toISOString(),
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  console.error("Stack:", err.stack);

  // Handle rate limit errors specifically
  if (err.status === 429) {
    return res.status(429).json({
      success: false,
      message: "Too many requests. Please slow down and try again later.",
      timestamp: new Date().toISOString(),
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    timestamp: new Date().toISOString(),
  });
});

// Database connection with retry logic
const connectDB = async (retries = 5, delay = 5000) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log("✅ MongoDB connected successfully");
    return true;
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);

    if (retries > 0) {
      console.log(
        `Retrying connection in ${delay / 1000} seconds... (${retries} retries left)`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return connectDB(retries - 1, delay);
    }

    console.error("❌ All MongoDB connection retries failed");
    return false;
  }
};

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("         ENTERPRISE TASK MANAGEMENT SYSTEM");
  console.log("═══════════════════════════════════════════════════════════");

  // Connect to database
  const dbConnected = await connectDB();

  if (!dbConnected) {
    console.log("\n⚠️  Server starting without database connection");
    console.log("   Some features may not work properly\n");
  }

  // Start listening
  const server = app.listen(PORT, () => {
    console.log(`\n📡 Server:          http://localhost:${PORT}`);
    console.log(`🌍 Environment:     ${process.env.NODE_ENV || "development"}`);
    console.log(`🕐 Started at:      ${new Date().toLocaleString()}`);
    console.log(
      `💾 Database:        ${dbConnected ? "Connected ✅" : "Disconnected ⚠️"}`,
    );
    console.log(
      `🚦 Rate Limiting:   ${process.env.NODE_ENV === "production" ? "Enabled" : "Development Mode (Limited)`"}`,
    );

    console.log(
      "\n───────────────────────────────────────────────────────────",
    );
    console.log("📋 AVAILABLE ENDPOINTS:");
    console.log("───────────────────────────────────────────────────────────");

    console.log("\n🔐 AUTHENTICATION:");
    console.log(`   POST   /api/v1/auth/login       - Login user`);
    console.log(
      `   POST   /api/v1/auth/register    - Register user (Admin only)`,
    );
    console.log(
      `   GET    /api/v1/auth/users       - Get all users (Admin only)`,
    );
    console.log(`   GET    /api/v1/auth/me          - Get current user`);
    console.log(
      `   PUT    /api/v1/auth/users/:id   - Update user (Admin only)`,
    );
    console.log(
      `   DELETE /api/v1/auth/users/:id   - Delete user (Super Admin only)`,
    );
    console.log(
      `   PUT    /api/v1/auth/users/:id/role - Change user role (Super Admin only)`,
    );
    console.log(`   POST   /api/v1/auth/change-password - Change password`);
    console.log(`   POST   /api/v1/auth/logout      - Logout user`);

    console.log("\n👤 USER PROFILE:");
    console.log(`   GET    /api/v1/users/me         - Get my profile`);
    console.log(`   PUT    /api/v1/users/profile    - Update my profile`);
    console.log(`   POST   /api/v1/users/profile/photo - Upload profile photo`);
    console.log(`   GET    /api/v1/users/export     - Export users data`);
    console.log(`   POST   /api/v1/users/bulk-import - Bulk import users`);

    console.log("\n🏢 DEPARTMENTS:");
    console.log(`   GET    /api/v1/departments       - Get all departments`);
    console.log(
      `   POST   /api/v1/departments       - Create department (Super Admin only)`,
    );
    console.log(`   GET    /api/v1/departments/:id   - Get department by ID`);
    console.log(
      `   PUT    /api/v1/departments/:id   - Update department (Super Admin only)`,
    );
    console.log(
      `   DELETE /api/v1/departments/:id   - Delete department (Super Admin only)`,
    );
    console.log(
      `   GET    /api/v1/departments/:id/employees - Get department employees`,
    );

    console.log("\n📋 TASKS:");
    console.log(`   GET    /api/v1/tasks              - Get all tasks`);
    console.log(`   GET    /api/v1/tasks/my-tasks     - Get my tasks`);
    console.log(`   POST   /api/v1/tasks              - Create task`);
    console.log(`   GET    /api/v1/tasks/:id          - Get task by ID`);
    console.log(`   PUT    /api/v1/tasks/:id          - Update task`);
    console.log(`   PATCH  /api/v1/tasks/:id/status   - Update task status`);
    console.log(`   DELETE /api/v1/tasks/:id          - Delete task`);
    console.log(
      `   POST   /api/v1/tasks/:id/request-extension - Request extension`,
    );
    console.log(
      `   POST   /api/v1/tasks/:id/approve-extension/:extensionId - Approve extension`,
    );

    console.log("\n❤️  HEALTH:");
    console.log(`   GET    /health                   - Health check`);
    console.log(`   GET    /                         - API information`);

    console.log(
      "\n═══════════════════════════════════════════════════════════",
    );
    console.log("✅ Server is ready to accept requests");
    console.log(
      "═══════════════════════════════════════════════════════════\n",
    );
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal) => {
    console.log(`\n\n⚠️  Received ${signal}. Shutting down gracefully...`);

    server.close(async () => {
      console.log("✅ HTTP server closed");

      try {
        await mongoose.disconnect();
        console.log("✅ Database disconnected");
      } catch (err) {
        console.error("❌ Error disconnecting database:", err);
      }

      console.log("✅ Graceful shutdown completed");
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error(
        "❌ Could not close connections in time, forcefully shutting down",
      );
      process.exit(1);
    }, 10000);
  };

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error);
    gracefulShutdown("uncaughtException");
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
    gracefulShutdown("unhandledRejection");
  });
};

startServer();
