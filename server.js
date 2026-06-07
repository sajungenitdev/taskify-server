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

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
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

// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin for uploads
  }),
);
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:5000",
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
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

app.options("*", cors());
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(limiter);

// Static files - Serve uploads directory
const uploadsPath = path.join(__dirname, "uploads");
console.log(`📁 Uploads directory: ${uploadsPath}`);

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
  console.log("📁 Created uploads directory");
}

// Create tasks subdirectory
const tasksUploadsPath = path.join(uploadsPath, "tasks");
if (!fs.existsSync(tasksUploadsPath)) {
  fs.mkdirSync(tasksUploadsPath, { recursive: true });
  console.log("📁 Created tasks uploads directory");
}

// Create avatars subdirectory (for user avatars)
const avatarsUploadsPath = path.join(uploadsPath, "avatars");
if (!fs.existsSync(avatarsUploadsPath)) {
  fs.mkdirSync(avatarsUploadsPath, { recursive: true });
  console.log("📁 Created avatars uploads directory");
}

// Serve static files
app.use(
  "/uploads",
  express.static(uploadsPath, {
    setHeaders: (res, filePath) => {
      // Set proper content type for images
      if (filePath.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        res.setHeader(
          "Content-Type",
          `image/${path.extname(filePath).slice(1)}`,
        );
      }
      // Allow caching for better performance
      res.setHeader("Cache-Control", "public, max-age=31536000");
    },
  }),
);

// Test endpoint for uploads (for debugging)
app.get("/test-uploads", (req, res) => {
  try {
    const files = fs.readdirSync(tasksUploadsPath);
    res.json({
      success: true,
      message: "Uploads directory is accessible",
      uploadsPath: uploadsPath,
      tasksPath: tasksUploadsPath,
      filesCount: files.length,
      files: files.slice(0, 20), // Show first 20 files
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

// Routes
const authRoutes = require("./src/routes/auth.routes");
const userRoutes = require("./src/routes/user.routes");
const departmentRoutes = require("./src/routes/department.routes");
const taskRoutes = require("./src/routes/task.routes");
const projectRoutes = require("./src/routes/project.routes");
const resourceRoutes = require("./src/routes/resource.routes");
const templateRoutes = require("./src/routes/template.routes");
const roleRoutes = require("./src/routes/role.routes");

// API Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/departments", departmentRoutes);
app.use("/api/v1/tasks", taskRoutes);
app.use("/api/v1/projects", projectRoutes);
app.use("/api/v1/resources", resourceRoutes);
app.use("/api/v1/templates", templateRoutes);
app.use("/api/v1/roles", roleRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    uploadsDir: fs.existsSync(uploadsPath),
    endpoints: {
      tasks: "/api/v1/tasks",
      projects: "/api/v1/projects",
      resources: "/api/v1/resources",
      templates: "/api/v1/templates",
      departments: "/api/v1/departments",
      auth: "/api/v1/auth",
      users: "/api/v1/users",
      testUploads: "/test-uploads",
    },
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
      auth: "/api/v1/auth",
      users: "/api/v1/users",
      departments: "/api/v1/departments",
      tasks: "/api/v1/tasks",
      projects: "/api/v1/projects",
      resources: "/api/v1/resources",
      templates: "/api/v1/templates",
      health: "/health",
      testUploads: "/test-uploads",
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
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    timestamp: new Date().toISOString(),
  });
});

// Database connection
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

// Start server
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
  console.log(`📁 Tasks uploads exists: ${fs.existsSync(tasksUploadsPath)}`);
  console.log(
    `📁 Avatars uploads exists: ${fs.existsSync(avatarsUploadsPath)}`,
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
    console.log(`🧪 Test uploads:    http://localhost:${PORT}/test-uploads`);
    console.log(
      "\n═══════════════════════════════════════════════════════════\n",
    );
  });
};

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n\n🛑 Shutting down gracefully...");
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    console.log("📦 MongoDB connection closed");
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n\n🛑 Shutting down gracefully...");
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    console.log("📦 MongoDB connection closed");
  }
  process.exit(0);
});

startServer();
