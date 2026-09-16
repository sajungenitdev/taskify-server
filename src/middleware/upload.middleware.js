// middleware/upload.middleware.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// ============================================================
// UPLOAD DIRECTORY CONFIGURATION — CHAT
// ============================================================

const uploadDir = path.join(__dirname, "../uploads/chat");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const subDirs = ["images", "documents", "audio", "videos", "others"];
subDirs.forEach((dir) => {
  const dirPath = path.join(uploadDir, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// ============================================================
// UPLOAD DIRECTORY CONFIGURATION — TENDERS
// ============================================================

const tenderUploadDir = path.join(__dirname, "../uploads/tenders");
if (!fs.existsSync(tenderUploadDir)) {
  fs.mkdirSync(tenderUploadDir, { recursive: true });
}

// ============================================================
// FILE FILTER - Allow all common file types
// ============================================================

const fileFilter = (req, file, cb) => {
  // Allow everything; unknown types land in "others"
  cb(null, true);
};

// ============================================================
// STORAGE CONFIGURATION — CHAT
// ============================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subDir = "others";
    const mimeType = file.mimetype;

    if (mimeType.startsWith("image/")) subDir = "images";
    else if (mimeType.startsWith("audio/")) subDir = "audio";
    else if (mimeType.startsWith("video/")) subDir = "videos";
    else if (
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
    cb(null, `${timestamp}-${uniqueId}${extension}`);
  },
});

// ============================================================
// STORAGE CONFIGURATION — TENDERS
//   Files land in uploads/tenders/<timestamp>-<id><ext>
// ============================================================

const tenderStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(tenderUploadDir)) {
      fs.mkdirSync(tenderUploadDir, { recursive: true });
    }
    cb(null, tenderUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = crypto.randomBytes(8).toString("hex");
    const timestamp = Date.now();
    const safeOriginal = path
      .basename(file.originalname)
      .replace(/[^\w.\-]+/g, "_");
    const extension = path.extname(safeOriginal);
    const base = path.basename(safeOriginal, extension).slice(0, 60);
    cb(null, `${timestamp}-${uniqueId}-${base}${extension}`);
  },
});

// ============================================================
// MULTER CONFIGURATION
// ============================================================

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
  fileFilter,
});

const tenderUpload = multer({
  storage: tenderStorage,
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter,
});

// ============================================================
// FILE TYPE + ICON HELPERS (unchanged)
// ============================================================

const getFileType = (mimeType) => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "voice";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  if (
    mimeType === "application/msword" ||
    mimeType.includes("wordprocessingml")
  )
    return "document";
  if (
    mimeType === "application/vnd.ms-excel" ||
    mimeType.includes("spreadsheetml")
  )
    return "spreadsheet";
  if (
    mimeType === "application/vnd.ms-powerpoint" ||
    mimeType.includes("presentationml")
  )
    return "presentation";
  if (mimeType === "text/csv") return "spreadsheet";
  if (mimeType === "text/plain") return "document";
  if (
    mimeType === "application/zip" ||
    mimeType === "application/x-rar-compressed" ||
    mimeType === "application/x-7z-compressed"
  )
    return "archive";
  return "file";
};

const getFileIcon = (mimeType) => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  if (
    mimeType === "application/msword" ||
    mimeType.includes("wordprocessingml")
  )
    return "word";
  if (
    mimeType === "application/vnd.ms-excel" ||
    mimeType.includes("spreadsheetml")
  )
    return "excel";
  if (
    mimeType === "application/vnd.ms-powerpoint" ||
    mimeType.includes("presentationml")
  )
    return "powerpoint";
  if (mimeType === "text/csv") return "csv";
  if (mimeType === "text/plain") return "text";
  if (
    mimeType === "application/zip" ||
    mimeType === "application/x-rar-compressed"
  )
    return "archive";
  return "file";
};

module.exports = {
  upload,
  tenderUpload,          // ← NEW
  tenderUploadDir,       // ← NEW (needed by delete handler)
  getFileType,
  getFileIcon,
  uploadDir,
};