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

function computeStatus(doc) {
  if (!doc.validUntil) {
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
  if (diffDays < 0) return { ...doc, status: "Expired", action: "Renew" };
  if (diffDays <= 30) return { ...doc, status: "Expiring Soon", action: "Renew" };
  return {
    ...doc,
    status: "Valid",
    action: doc.action === "Renew" ? "View" : doc.action || "View",
  };
}

function buildChipFilter({ sector, duration, volume }) {
  const chipFilters = [];
  if (sector && sector !== "all") chipFilters.push(sector);
  if (duration && duration !== "all") chipFilters.push(duration);
  if (volume && volume !== "all") chipFilters.push(volume);

  if (chipFilters.length === 0) return null;
  if (chipFilters.length === 1) return chipFilters[0];
  return { $all: chipFilters };
}

/* Projection for list views — excludes the heavy importedInto array
 * and internal tracking fields. Cuts payload size by ~40%. */
const LIST_PROJECTION =
  "-importedInto -createdBy -updatedBy -__v";

/* ============================================================
 * LIST — category + optional filters
 * GET /api/v1/tenders/docs/list?category=legal
 * ============================================================ */
const listDocs = async (req, res) => {
  try {
    const { category, sector, duration, volume, status } = req.query;

    const query = {};
    if (category && category !== "all") query.category = category;

    const chipFilter = buildChipFilter({ sector, duration, volume });
    if (chipFilter) query.chips = chipFilter;

    const rows = await CompanyDocument.find(query, LIST_PROJECTION)
      .sort({ createdAt: -1 })
      .lean();

    let enriched = rows.map(computeStatus);

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
 * COMBINED list + counts
 * GET /api/v1/tenders/docs/bundle?category=legal
 * ============================================================ */
const listAndCounts = async (req, res) => {
  try {
    const { category, sector, duration, volume, status } = req.query;

    const query = {};
    if (category && category !== "all") query.category = category;

    const chipFilter = buildChipFilter({ sector, duration, volume });
    if (chipFilter) query.chips = chipFilter;

    /* Parallel: list + counts aggregation */
    const [rows, countsAgg] = await Promise.all([
      CompanyDocument.find(query, LIST_PROJECTION)
        .sort({ createdAt: -1 })
        .lean(),

      CompanyDocument.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
    ]);

    let enriched = rows.map(computeStatus);

    if (status && status !== "all") {
      const map = {
        expired: "Expired",
        expiring: "Expiring Soon",
        valid: "Valid",
      };
      const target = map[status];
      if (target) enriched = enriched.filter((d) => d.status === target);
    }

    const counts = { legal: 0, profiles: 0, experience: 0, certificates: 0 };
    countsAgg.forEach((c) => {
      if (counts[c._id] !== undefined) counts[c._id] = c.count;
    });

    res.json({ success: true, data: { list: enriched, counts } });
  } catch (error) {
    console.error("listAndCounts error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * COUNTS ONLY (legacy)
 * ============================================================ */
const docCounts = async (_req, res) => {
  try {
    const rows = await CompanyDocument.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);
    const counts = { legal: 0, profiles: 0, experience: 0, certificates: 0 };
    rows.forEach((r) => {
      if (counts[r._id] !== undefined) counts[r._id] = r.count;
    });
    res.json({ success: true, data: counts });
  } catch (error) {
    console.error("docCounts error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * CREATE
 * POST /api/v1/tenders/docs
 * ============================================================ */
const createDoc = async (req, res) => {
  try {
    const {
      category,
      title,
      description,          // ← new
      reference,
      validity,
      validityDate,
      issuedOn,
      subtitle,             // ← legacy / experience
      chips,
      fileUrl,
      docType,
    } = req.body;

    if (!category || !title?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "category and title are required" });
    }

    /* For profile category, prefer `description`; fall back to `subtitle`
     * so existing clients that still send `subtitle` keep working. */
    const finalDescription =
      category === "profiles"
        ? (description || subtitle || "").trim()
        : (description || "").trim();

    const doc = await CompanyDocument.create({
      category,
      title: title.trim(),
      description: finalDescription,
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
 * PATCH /api/v1/tenders/docs/:id
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
      "description",       // ← new
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
 * POST /api/v1/tenders/docs/:id/renew
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
 * DELETE /api/v1/tenders/docs/:id
 * ============================================================ */
const deleteDoc = async (req, res) => {
  try {
    const doc = await CompanyDocument.findById(req.params.id);
    if (!doc) {
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });
    }

    /* Remove file from disk first (fire-and-forget) */
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
 * POST /api/v1/tenders/docs/import
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
 * UPLOAD FILE
 * POST /api/v1/tenders/docs/:id/file
 * ============================================================ */
const uploadDocFile = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    /* Update via findOneAndUpdate to avoid loading + saving the whole doc */
    const prev = await CompanyDocument.findById(req.params.id)
      .select("fileUrl")
      .lean();

    if (!prev) {
      try {
        fs.unlinkSync(req.file.path);
      } catch { }
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });
    }

    /* Remove old file from disk */
    if (prev.fileUrl) {
      try {
        const oldName = path.basename(prev.fileUrl);
        const full = path.join(companyDocUploadDir, oldName);
        if (fs.existsSync(full)) fs.unlinkSync(full);
      } catch (err) {
        console.warn("Could not delete old file:", err.message);
      }
    }

    const newUrl = `/uploads/company-docs/${req.file.filename}`;

    const doc = await CompanyDocument.findByIdAndUpdate(
      req.params.id,
      {
        fileUrl: newUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileMime: req.file.mimetype,
        updatedBy: req.user._id,
      },
      { new: true },
    ).lean();

    console.log("[uploadDocFile] ✅ saved:", newUrl);

    res.status(201).json({ success: true, data: computeStatus(doc) });
  } catch (error) {
    console.error("uploadDocFile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  listDocs,
  docCounts,
  listAndCounts,
  createDoc,
  updateDoc,
  renewDoc,
  deleteDoc,
  importDocsToTender,
  uploadDocFile,
};