// middleware/upload.middleware.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// ============================================================
// UPLOAD DIRECTORY CONFIGURATION
// ============================================================

const uploadDir = path.join(__dirname, "../uploads/chat");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Subdirectories for different file types
const subDirs = ["images", "documents", "audio", "videos", "others"];
subDirs.forEach(dir => {
  const dirPath = path.join(uploadDir, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// ============================================================
// FILE FILTER - Allow all common file types
// ============================================================

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    // Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/bmp",
    "image/tiff",
    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/csv",
    "application/rtf",
    // Archives
    "application/zip",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
    "application/gzip",
    // Audio
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/webm",
    "audio/aac",
    // Video
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/quicktime",
    // Code files
    "text/javascript",
    "text/css",
    "text/html",
    "application/json",
    "application/xml",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    // Allow unknown types but mark as 'other'
    cb(null, true);
  }
};

// ============================================================
// STORAGE CONFIGURATION
// ============================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subDir = "others";
    const mimeType = file.mimetype;

    if (mimeType.startsWith("image/")) {
      subDir = "images";
    } else if (mimeType.startsWith("audio/")) {
      subDir = "audio";
    } else if (mimeType.startsWith("video/")) {
      subDir = "videos";
    } else if (
      mimeType === "application/pdf" ||
      mimeType === "application/msword" ||
      mimeType.includes("wordprocessingml") ||
      mimeType === "text/plain" ||
      mimeType === "text/csv" ||
      mimeType === "application/rtf"
    ) {
      subDir = "documents";
    }

    const destPath = path.join(uploadDir, subDir);
    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(destPath, { recursive: true });
    }
    cb(null, destPath);
  },
  filename: (req, file, cb) => {
    const uniqueId = crypto.randomBytes(8).toString("hex");
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    const fileName = `${timestamp}-${uniqueId}${extension}`;
    cb(null, fileName);
  },
});

// ============================================================
// MULTER CONFIGURATION
// ============================================================

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
    files: 10, // Max 10 files per upload
  },
  fileFilter: fileFilter,
});

// ============================================================
// FILE TYPE HELPER
// ============================================================

const getFileType = (mimeType) => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "voice";
  if (mimeType.startsWith("video/")) return "video";
  
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "application/msword" || mimeType.includes("wordprocessingml")) return "document";
  if (mimeType === "application/vnd.ms-excel" || mimeType.includes("spreadsheetml")) return "spreadsheet";
  if (mimeType === "application/vnd.ms-powerpoint" || mimeType.includes("presentationml")) return "presentation";
  if (mimeType === "text/csv") return "spreadsheet";
  if (mimeType === "text/plain") return "document";
  
  if (mimeType === "application/zip" || mimeType === "application/x-rar-compressed" || mimeType === "application/x-7z-compressed") {
    return "archive";
  }
  
  return "file";
};

// ============================================================
// FILE ICON HELPER
// ============================================================

const getFileIcon = (mimeType) => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "application/msword" || mimeType.includes("wordprocessingml")) return "word";
  if (mimeType === "application/vnd.ms-excel" || mimeType.includes("spreadsheetml")) return "excel";
  if (mimeType === "application/vnd.ms-powerpoint" || mimeType.includes("presentationml")) return "powerpoint";
  if (mimeType === "text/csv") return "csv";
  if (mimeType === "text/plain") return "text";
  if (mimeType === "application/zip" || mimeType === "application/x-rar-compressed") return "archive";
  return "file";
};

module.exports = {
  upload,
  getFileType,
  getFileIcon,
  uploadDir,
};