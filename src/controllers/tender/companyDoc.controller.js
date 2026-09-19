// src/controllers/tender/companyDoc.controller.js
const path = require("path");
const fs = require("fs");
const CompanyDocument = require("../../models/CompanyDocument.model");
const {
  companyDocUploadDir,
} = require("../../middleware/upload.middleware");

/* ============================================================
 * HELPERS
 * ============================================================ */
function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/* Compute status + action from validUntil — always fresh */
function computeStatus(doc) {
  if (!doc.validUntil) {
    // No expiry — leave status as-is (default "Valid"), action "View"
    return {
      ...doc,
      status: doc.status || "Valid",
      action: doc.action === "Renew" ? "View" : doc.action || "View",
    };
  }
  const now = Date.now();
  const diffDays = Math.ceil(
    (new Date(doc.validUntil).getTime() - now) / 86400000,
  );
  if (diffDays < 0) {
    return { ...doc, status: "Expired", action: "Renew" };
  }
  if (diffDays <= 30) {
    return { ...doc, status: "Expiring Soon", action: "Renew" };
  }
  return {
    ...doc,
    status: "Valid",
    action: doc.action === "Renew" ? "View" : doc.action || "View",
  };
}

/* ============================================================
 * LIST — filter by category + optional filters on experience
 * ============================================================ */
const listDocs = async (req, res) => {
  try {
    const { category, sector, duration, volume, status } = req.query;

    const query = {};
    if (category && category !== "all") query.category = category;

    const chipFilters = [];
    if (sector && sector !== "all") chipFilters.push(sector);
    if (duration && duration !== "all") chipFilters.push(duration);
    if (volume && volume !== "all") chipFilters.push(volume);

    if (chipFilters.length === 1) query.chips = chipFilters[0];
    else if (chipFilters.length > 1) query.chips = { $all: chipFilters };

    const rows = await CompanyDocument.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Recompute status/action on every read
    let enriched = rows.map(computeStatus);

    // Apply status filter AFTER recompute (so it reflects live values)
    if (status && status !== "all") {
      const map = {
        expired: "Expired",
        expiring: "Expiring Soon",
        valid: "Valid",
      };
      const target = map[status];
      if (target) enriched = enriched.filter((d) => d.status === target);
    }

    res.json({ success: true, data: enriched });
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
    const rows = await CompanyDocument.find({}).lean();
    const counts = { legal: 0, profiles: 0, experience: 0, certificates: 0 };
    for (const r of rows) {
      if (counts[r.category] !== undefined) counts[r.category] += 1;
    }
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
      validityDate,
      issuedOn,
      subtitle,
      chips,
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
      validUntil: toDate(validityDate),
      issuedOn: toDate(issuedOn),
      subtitle: subtitle || "",
      chips: Array.isArray(chips) ? chips : [],
      fileUrl: fileUrl || "",
      docType: docType || "",
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    const obj = doc.toObject();
    res.status(201).json({ success: true, data: computeStatus(obj) });
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
      "fileUrl",
      "docType",
    ];
    for (const k of allowed) {
      if (req.body[k] !== undefined) doc[k] = req.body[k];
    }

    if (req.body.validityDate !== undefined) {
      doc.validUntil = toDate(req.body.validityDate);
    }
    if (req.body.issuedOn !== undefined) {
      doc.issuedOn = toDate(req.body.issuedOn);
    }

    doc.updatedBy = req.user._id;
    await doc.save();

    const obj = doc.toObject();
    res.json({ success: true, data: computeStatus(obj) });
  } catch (error) {
    console.error("updateDoc error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * RENEW
 * ============================================================ */
const renewDoc = async (req, res) => {
  try {
    const { validityDate, issuedOn } = req.body;

    if (!validityDate) {
      return res
        .status(400)
        .json({ success: false, message: "validityDate is required" });
    }

    const doc = await CompanyDocument.findById(req.params.id);
    if (!doc) {
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });
    }

    doc.validUntil = toDate(validityDate);
    if (issuedOn !== undefined) doc.issuedOn = toDate(issuedOn);
    doc.updatedBy = req.user._id;
    await doc.save();

    const obj = doc.toObject();
    res.json({ success: true, data: computeStatus(obj) });
  } catch (error) {
    console.error("renewDoc error:", error);
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
      },
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

    const obj = doc.toObject();
    res.status(201).json({ success: true, data: computeStatus(obj) });
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
  renewDoc,
  deleteDoc,
  importDocsToTender,
  uploadDocFile,
};