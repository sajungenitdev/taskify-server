// middleware/upload.middleware.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// ============================================================
// UPLOAD DIRECTORIES
// ============================================================

// Chat uploads
const uploadDir = path.join(__dirname, "../uploads/chat");
fs.mkdirSync(uploadDir, { recursive: true });

const subDirs = ["images", "documents", "audio", "videos", "others"];
subDirs.forEach((dir) => {
  fs.mkdirSync(path.join(uploadDir, dir), { recursive: true });
});

// Tender uploads
const tenderUploadDir = path.join(__dirname, "../uploads/tenders");
fs.mkdirSync(tenderUploadDir, { recursive: true });

console.log("[upload.middleware] uploadDir:", uploadDir);
console.log("[upload.middleware] tenderUploadDir:", tenderUploadDir);

// ============================================================
// FILE FILTER — allow everything
// ============================================================

const fileFilter = (_req, _file, cb) => cb(null, true);

// ============================================================
// STORAGE — CHAT
// ============================================================

const chatStorage = multer.diskStorage({
  destination: (_req, file, cb) => {
    let subDir = "others";
    const mime = file.mimetype;
    if (mime.startsWith("image/")) subDir = "images";
    else if (mime.startsWith("audio/")) subDir = "audio";
    else if (mime.startsWith("video/")) subDir = "videos";
    else if (
      mime === "application/pdf" ||
      mime === "application/msword" ||
      mime.includes("wordprocessingml") ||
      mime === "text/plain" ||
      mime === "text/csv" ||
      mime === "application/rtf"
    ) {
      subDir = "documents";
    }
    const dest = path.join(uploadDir, subDir);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const id = crypto.randomBytes(8).toString("hex");
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${id}${ext}`);
  },
});

// ============================================================
// STORAGE — TENDERS
// ============================================================

const tenderStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(tenderUploadDir, { recursive: true });
    console.log("[tenderStorage.destination] →", tenderUploadDir);
    cb(null, tenderUploadDir);
  },
  filename: (_req, file, cb) => {
    const id = crypto.randomBytes(8).toString("hex");
    const ext = path.extname(file.originalname) || "";
    const base =
      path
        .basename(file.originalname, ext)
        .replace(/[^\w.\-]+/g, "_")
        .slice(0, 60) || "file";
    const name = `${Date.now()}-${id}-${base}${ext}`;
    console.log("[tenderStorage.filename] →", name);
    cb(null, name);
  },
});

// ============================================================
// MULTER INSTANCES
// ============================================================

const upload = multer({
  storage: chatStorage,
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
  fileFilter,
});

const tenderUpload = multer({
  storage: tenderStorage,
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter,
});

// ============================================================
// HELPERS
// ============================================================

const getFileType = (mimeType) => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "voice";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "application/msword" || mimeType.includes("wordprocessingml"))
    return "document";
  if (mimeType === "application/vnd.ms-excel" || mimeType.includes("spreadsheetml"))
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
  if (mimeType === "application/msword" || mimeType.includes("wordprocessingml"))
    return "word";
  if (mimeType === "application/vnd.ms-excel" || mimeType.includes("spreadsheetml"))
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
  tenderUpload,
  tenderUploadDir,
  uploadDir,
  getFileType,
  getFileIcon,
};