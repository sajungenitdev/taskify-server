const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");

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
app.use(helmet());
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:5000",
        "https://taskify-frontend-delta.vercel.app",
        "https://taskify-server-5gat.onrender.com",
        undefined,
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
  }),
);

app.options("*", cors());
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(limiter);

// Static files
app.use("/uploads", express.static("uploads"));

// Routes
const authRoutes = require("./src/routes/auth.routes");
const userRoutes = require("./src/routes/user.routes");
const departmentRoutes = require("./src/routes/department.routes");

// API Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/departments", departmentRoutes);

// Health check
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
      auth: "/api/v1/auth",
      users: "/api/v1/users",
      departments: "/api/v1/departments",
      health: "/health",
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
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    timestamp: new Date().toISOString(),
  });
});

// Database connection
const connectDB = async (retries = 5, delay = 5000) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
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

  app.listen(PORT, () => {
    console.log(`\n📡 Server:          http://localhost:${PORT}`);
    console.log(`🌍 Environment:     ${process.env.NODE_ENV || "development"}`);
    console.log(
      `💾 Database:        ${dbConnected ? "Connected ✅" : "Disconnected ⚠️"}`,
    );
    console.log(
      `🔐 Auth endpoint:   http://localhost:${PORT}/api/v1/auth/login`,
    );
    console.log(
      "\n═══════════════════════════════════════════════════════════\n",
    );
  });
};

startServer();
