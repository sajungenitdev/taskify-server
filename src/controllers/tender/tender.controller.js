// src/controllers/tender/tender.controller.js
const Tender = require("../../models/Tender.model");
const TenderDocumentTask = require("../../models/TenderDocumentTask.model");
const path = require("path");
const fs = require("fs");
const { tenderUploadDir } = require("../../middleware/upload.middleware");

/* ============================================================
 * LIST TENDERS
 * ============================================================ */
const listTenders = async (req, res) => {
  try {
    const { stage, tenderType, search, page = 1, limit = 100 } = req.query;

    const query = {};
    if (stage && stage !== "all") query.stage = stage;
    if (tenderType && tenderType !== "all") query.tenderType = tenderType;
    if (search) {
      query.$or = [
        { tenderer: { $regex: search, $options: "i" } },
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const [rows, total] = await Promise.all([
      Tender.find(query)
        .populate("owner", "fullName email")
        .sort({ updatedAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .lean(),
      Tender.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("listTenders error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * GET ONE
 * ============================================================ */
const getTender = async (req, res) => {
  try {
    const tender = await Tender.findById(req.params.id)
      .populate("owner", "fullName email")
      .lean();

    if (!tender) {
      return res
        .status(404)
        .json({ success: false, message: "Tender not found" });
    }

    const docTasks = await TenderDocumentTask.find({ tenderId: tender._id })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    res.json({ success: true, data: { ...tender, docTasks } });
  } catch (error) {
    console.error("getTender error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * CREATE TENDER
 * ============================================================ */
const createTender = async (req, res) => {
  try {
    const {
      tenderer,
      title,
      stage = "potential",
      tenderType,
      description,
      tenderLink,
      recordedBy,
      responsiblePerson,
      lastDateOfPurchase,
      lastDateOfSubmission,
      tentativeBudget,
      currency,
      tenderSecurityAmount,
      mode,
      note,
      eligibility,
    } = req.body;

    if (!tenderer?.trim() || !title?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "tenderer and title are required" });
    }

    const tender = await Tender.create({
      tenderer: tenderer.trim(),
      title: title.trim(),
      stage,
      tenderType: tenderType || "eGP",
      description: description || "",
      tenderLink: tenderLink || "",
      recordedBy: recordedBy || req.user.fullName || "",
      responsiblePerson: responsiblePerson || "",
      lastDateOfPurchase: lastDateOfPurchase
        ? new Date(lastDateOfPurchase)
        : null,
      lastDateOfSubmission: lastDateOfSubmission
        ? new Date(lastDateOfSubmission)
        : null,
      tentativeBudget: Number(tentativeBudget) || 0,
      currency: currency || "BDT",
      tenderSecurityAmount: Number(tenderSecurityAmount) || 0,
      mode: mode || "",
      note: note || "",
      eligibility: eligibility || "",
      owner: req.user._id,
      departmentId: req.user.departmentId,
      createdBy: req.user._id,
      updatedBy: req.user._id,
      stageHistory: [
        { from: null, to: stage, at: new Date(), by: req.user._id },
      ],
    });

    res.status(201).json({ success: true, data: tender });
  } catch (error) {
    console.error("createTender error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * UPDATE TENDER
 * ============================================================ */
const updateTender = async (req, res) => {
  try {
    const tender = await Tender.findById(req.params.id);
    if (!tender) {
      return res
        .status(404)
        .json({ success: false, message: "Tender not found" });
    }

    const allowed = [
      "tenderer",
      "title",
      "tenderType",
      "description",
      "tenderLink",
      "recordedBy",
      "responsiblePerson",
      "lastDateOfPurchase",
      "lastDateOfSubmission",
      "tentativeBudget",
      "currency",
      "tenderSecurityAmount",
      "performanceSecurityAmount",
      "securityMode",
      "mode",
      "readiness",
      "docStatus",
      "advertisementFile",
      "advertisementUploadedBy",
      "note",
      "eligibility",
      "attachments",
      "otherParticipants",
      "lossReason",
      "lowestCompliantBidder",
      "lowestCompliantValue",
    ];

    for (const k of allowed) {
      if (req.body[k] !== undefined) tender[k] = req.body[k];
    }
    tender.updatedBy = req.user._id;

    await tender.save();
    res.json({ success: true, data: tender });
  } catch (error) {
    console.error("updateTender error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * CHANGE STAGE
 * ============================================================ */
const changeStage = async (req, res) => {
  try {
    const { stage, note, lossReason } = req.body;
    if (!stage) {
      return res
        .status(400)
        .json({ success: false, message: "stage is required" });
    }

    const tender = await Tender.findById(req.params.id);
    if (!tender) {
      return res
        .status(404)
        .json({ success: false, message: "Tender not found" });
    }

    const fromStage = tender.stage;
    if (fromStage === stage) {
      return res.json({ success: true, data: tender });
    }

    tender.stage = stage;
    tender.updatedBy = req.user._id;

    if (stage === "submitted") {
      tender.submitted = true;
      tender.submittedAt = new Date();
    }
    if (stage === "lost") {
      tender.lostAt = new Date();
      if (lossReason) tender.lossReason = lossReason;
    }

    tender.stageHistory.push({
      from: fromStage,
      to: stage,
      at: new Date(),
      by: req.user._id,
      note: note || "",
    });

    await tender.save();
    res.json({ success: true, data: tender });
  } catch (error) {
    console.error("changeStage error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * DELETE TENDER
 * ============================================================ */
const deleteTender = async (req, res) => {
  try {
    const tender = await Tender.findByIdAndDelete(req.params.id);
    if (!tender) {
      return res
        .status(404)
        .json({ success: false, message: "Tender not found" });
    }
    await TenderDocumentTask.deleteMany({ tenderId: tender._id });
    res.json({ success: true, message: "Tender deleted" });
  } catch (error) {
    console.error("deleteTender error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * DOCUMENT TASKS
 * ============================================================ */
const addDocTask = async (req, res) => {
  try {
    const { title, owner, status, fileName } = req.body;
    if (!title?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "title is required" });
    }

    const tender = await Tender.findById(req.params.id);
    if (!tender) {
      return res
        .status(404)
        .json({ success: false, message: "Tender not found" });
    }

    const count = await TenderDocumentTask.countDocuments({
      tenderId: tender._id,
    });

    const task = await TenderDocumentTask.create({
      tenderId: tender._id,
      title: title.trim(),
      owner: owner || "",
      status: status || "Pending",
      fileName: fileName || "No file uploaded yet",
      order: count,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    console.error("addDocTask error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateDocTask = async (req, res) => {
  try {
    const task = await TenderDocumentTask.findById(req.params.taskId);
    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    const allowed = ["title", "owner", "status", "fileName", "fileUrl", "order"];
    for (const k of allowed) {
      if (req.body[k] !== undefined) task[k] = req.body[k];
    }
    task.updatedBy = req.user._id;
    await task.save();

    res.json({ success: true, data: task });
  } catch (error) {
    console.error("updateDocTask error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteDocTask = async (req, res) => {
  try {
    const task = await TenderDocumentTask.findByIdAndDelete(req.params.taskId);
    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }
    res.json({ success: true, message: "Task deleted" });
  } catch (error) {
    console.error("deleteDocTask error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * UPDATE SUBMISSION CHECKLIST
 * ============================================================ */
const updateChecklist = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res
        .status(400)
        .json({ success: false, message: "items[] is required" });
    }

    const tender = await Tender.findById(req.params.id);
    if (!tender) {
      return res
        .status(404)
        .json({ success: false, message: "Tender not found" });
    }

    tender.checklist = items.map((it) => ({
      id: String(it.id),
      label: String(it.label),
      checked: !!it.checked,
      isCustom: !!it.isCustom,
    }));
    tender.updatedBy = req.user._id;

    await tender.save();
    res.json({ success: true, data: tender.checklist });
  } catch (error) {
    console.error("updateChecklist error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * UPLOAD ATTACHMENT
 * POST /api/v1/tenders/:id/attachments
 * ============================================================ */
const uploadAttachment = async (req, res) => {
  try {
    console.log("\n========== [uploadAttachment] START ==========");
    console.log("[uploadAttachment] params.id:", req.params.id);
    console.log(
      "[uploadAttachment] content-type:",
      req.headers["content-type"],
    );
    console.log("[uploadAttachment] req.file:", req.file);

    if (!req.file) {
      console.log("[uploadAttachment] ❌ no req.file — multer did not attach");
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    console.log("[uploadAttachment] ✅ file on disk:", req.file.path);
    console.log("[uploadAttachment]    size:", req.file.size);
    console.log("[uploadAttachment]    mime:", req.file.mimetype);
    console.log("[uploadAttachment]    original:", req.file.originalname);

    const tender = await Tender.findById(req.params.id);
    if (!tender) {
      console.log("[uploadAttachment] ❌ tender not found — cleaning up file");
      try {
        fs.unlinkSync(req.file.path);
      } catch {}
      return res
        .status(404)
        .json({ success: false, message: "Tender not found" });
    }

    const url = `/uploads/tenders/${req.file.filename}`;

    const attachment = {
      name: req.file.originalname,
      url,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date(),
    };

    tender.attachments.push(attachment);
    tender.updatedBy = req.user._id;
    await tender.save();

    const created = tender.attachments[tender.attachments.length - 1];

    console.log("[uploadAttachment] ✅ saved attachment _id:", created._id);
    console.log("[uploadAttachment]    url:", created.url);
    console.log("========== [uploadAttachment] END ==========\n");

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error("[uploadAttachment] ❌ error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * DELETE ATTACHMENT
 * DELETE /api/v1/tenders/:id/attachments/:attachmentId
 * ============================================================ */
const deleteAttachment = async (req, res) => {
  try {
    const tender = await Tender.findById(req.params.id);
    if (!tender) {
      return res
        .status(404)
        .json({ success: false, message: "Tender not found" });
    }

    const idx = tender.attachments.findIndex(
      (a) => String(a._id) === req.params.attachmentId,
    );
    if (idx === -1) {
      return res
        .status(404)
        .json({ success: false, message: "Attachment not found" });
    }

    try {
      const fileUrl = tender.attachments[idx].url || "";
      const filename = path.basename(fileUrl);
      const full = path.join(tenderUploadDir, filename);
      console.log("[deleteAttachment] unlinking:", full);
      if (filename && fs.existsSync(full)) fs.unlinkSync(full);
    } catch (err) {
      console.warn("Could not delete file from disk:", err.message);
    }

    tender.attachments.splice(idx, 1);
    tender.updatedBy = req.user._id;
    await tender.save();

    res.json({ success: true, message: "Attachment removed" });
  } catch (error) {
    console.error("deleteAttachment error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  listTenders,
  getTender,
  createTender,
  updateTender,
  changeStage,
  deleteTender,
  addDocTask,
  updateDocTask,
  deleteDocTask,
  updateChecklist,
  uploadAttachment,
  deleteAttachment,
};