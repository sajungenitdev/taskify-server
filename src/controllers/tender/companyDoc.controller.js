// src/controllers/tender/companyDoc.controller.js
const path = require("path");
const fs = require("fs");
const CompanyDocument = require("../../models/CompanyDocument.model");
const {
  companyDocUploadDir,
} = require("../../middleware/upload.middleware");

/* ============================================================
 * LIST — filter by category + optional filters on experience
 * ============================================================ */
const listDocs = async (req, res) => {
  try {
    const { category, sector, duration, volume } = req.query;

    const query = {};
    if (category && category !== "all") query.category = category;

    // Experience-tab chip filters
    if (sector && sector !== "all") query.chips = sector;
    if (duration && duration !== "all") {
      query.chips = query.chips
        ? { $all: [query.chips, duration] }
        : duration;
    }
    if (volume && volume !== "all") {
      query.chips = query.chips
        ? { $all: [query.chips, volume] }
        : volume;
    }

    const rows = await CompanyDocument.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("listDocs error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * COUNT PER CATEGORY (for tab badges)
 * ============================================================ */
const docCounts = async (_req, res) => {
  try {
    const agg = await CompanyDocument.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);

    const counts = {
      legal: 0,
      profiles: 0,
      experience: 0,
      certificates: 0,
    };
    for (const r of agg) counts[r._id] = r.count;

    res.json({ success: true, data: counts });
  } catch (error) {
    console.error("docCounts error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * CREATE
 * ============================================================ */
const createDoc = async (req, res) => {
  try {
    const {
      category,
      title,
      reference,
      validity,
      subtitle,
      chips,
      status,
      fileUrl,
      docType,
    } = req.body;

    if (!category || !title?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "category and title are required" });
    }

    const doc = await CompanyDocument.create({
      category,
      title: title.trim(),
      reference: reference || "",
      validity: validity || "",
      subtitle: subtitle || "",
      chips: Array.isArray(chips) ? chips : [],
      status: status || "Valid",
      action: "View",
      fileUrl: fileUrl || "",
      docType: docType || "",
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    console.error("createDoc error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * UPDATE
 * ============================================================ */
const updateDoc = async (req, res) => {
  try {
    const doc = await CompanyDocument.findById(req.params.id);
    if (!doc) {
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });
    }

    const allowed = [
      "title",
      "reference",
      "validity",
      "subtitle",
      "chips",
      "status",
      "action",
      "fileUrl",
      "docType",
    ];
    for (const k of allowed) {
      if (req.body[k] !== undefined) doc[k] = req.body[k];
    }
    doc.updatedBy = req.user._id;
    await doc.save();

    res.json({ success: true, data: doc });
  } catch (error) {
    console.error("updateDoc error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * DELETE
 * ============================================================ */
const deleteDoc = async (req, res) => {
  try {
    const doc = await CompanyDocument.findById(req.params.id);
    if (!doc) {
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });
    }

    // Remove attached file from disk (best-effort)
    if (doc.fileUrl) {
      try {
        const prev = path.basename(doc.fileUrl);
        const full = path.join(companyDocUploadDir, prev);
        if (fs.existsSync(full)) fs.unlinkSync(full);
      } catch (err) {
        console.warn("Could not delete file from disk:", err.message);
      }
    }

    await doc.deleteOne();
    res.json({ success: true, message: "Document deleted" });
  } catch (error) {
    console.error("deleteDoc error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * IMPORT SELECTED DOCS INTO A TENDER
 * ============================================================ */
const importDocsToTender = async (req, res) => {
  try {
    const { targetTenderId, documentIds } = req.body;

    if (!targetTenderId || !Array.isArray(documentIds) || !documentIds.length) {
      return res.status(400).json({
        success: false,
        message: "targetTenderId and documentIds[] are required",
      });
    }

    const result = await CompanyDocument.updateMany(
      { _id: { $in: documentIds } },
      {
        $push: {
          importedInto: {
            tenderId: targetTenderId,
            importedAt: new Date(),
            importedBy: req.user._id,
          },
        },
      }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} document(s) imported`,
    });
  } catch (error) {
    console.error("importDocsToTender error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * UPLOAD A FILE FOR AN EXISTING COMPANY DOC
 * POST /api/v1/tenders/docs/:id/file
 * ============================================================ */
const uploadDocFile = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const doc = await CompanyDocument.findById(req.params.id);
    if (!doc) {
      try {
        fs.unlinkSync(req.file.path);
      } catch { }
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });
    }

    // Remove previous file (best-effort)
    if (doc.fileUrl) {
      try {
        const prev = path.basename(doc.fileUrl);
        const full = path.join(companyDocUploadDir, prev);
        if (fs.existsSync(full)) fs.unlinkSync(full);
      } catch (err) {
        console.warn("Could not delete old file:", err.message);
      }
    }

    doc.fileUrl = `/uploads/company-docs/${req.file.filename}`;
    doc.fileName = req.file.originalname;
    doc.fileSize = req.file.size;
    doc.fileMime = req.file.mimetype;
    doc.updatedBy = req.user._id;
    await doc.save();

    console.log("[uploadDocFile] ✅ saved:", doc.fileUrl);

    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    console.error("uploadDocFile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  listDocs,
  docCounts,
  createDoc,
  updateDoc,
  deleteDoc,
  importDocsToTender,
  uploadDocFile,
};