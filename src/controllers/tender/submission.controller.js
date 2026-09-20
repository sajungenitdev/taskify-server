// src/controllers/tender/submission.controller.js
const Tender = require("../../models/Tender.model");
const TenderDocumentTask = require("../../models/TenderDocumentTask.model");

/**
 * Compute a checklist per tender from the doc tasks + submission state.
 */
function buildChecklist(tender, tasks) {
  const anyInProgress = tasks.some((t) => t.status === "In Progress");
  const anyPending = tasks.some((t) => t.status === "Pending");

  const daysToDeadline = tender.lastDateOfSubmission
    ? Math.max(
      0,
      Math.ceil(
        (new Date(tender.lastDateOfSubmission).getTime() - Date.now()) /
        86400000
      )
    )
    : 0;

  return [
    { id: "c1", label: "Pre-bid meeting", value: "N/A", tone: "neutral" },
    {
      id: "c2",
      label: "Tender security pay order ready",
      value: anyInProgress ? "In progress" : anyPending ? "Pending" : "Ready",
      tone: anyPending ? "warn" : "progress",
    },
    {
      id: "c3",
      label: "Submitted before deadline",
      value: tender.submitted
        ? "Submitted"
        : `${daysToDeadline} days remaining`,
      tone: tender.submitted ? "neutral" : "warn",
    },
  ];
}

/* ============================================================
 * LIST — active + submitted tenders
 * ============================================================ */
const listSubmissions = async (req, res) => {
  try {
    const tenders = await Tender.find({
      stage: { $in: ["active", "submitted"] },
    })
      .sort({ lastDateOfSubmission: 1 })
      .lean();

    const ids = tenders.map((t) => t._id);
    const tasks = await TenderDocumentTask.find({
      tenderId: { $in: ids },
    }).lean();

    const tasksByTender = tasks.reduce((acc, t) => {
      const key = String(t.tenderId);
      if (!acc[key]) acc[key] = [];
      acc[key].push(t);
      return acc;
    }, {});

    const rows = tenders.map((t) => {
      const ttasks = tasksByTender[String(t._id)] || [];
      return {
        id: t._id,
        tenderer: t.tenderer,
        mode: t.mode || t.tenderType || "",
        submitted: t.submitted ? "Submitted" : "Not yet",
        status: t.docStatus || "Docs pending",
        readiness: t.readiness ?? 0,
        _docTaskCount: ttasks.length,
      };
    });

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("listSubmissions error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * DETAIL — one tender's submission detail
 * ============================================================ */
/* ============================================================
 * DETAIL — one tender's submission detail
 * ============================================================ */
const getSubmissionDetail = async (req, res) => {
  try {
    const tender = await Tender.findById(req.params.id).lean();
    if (!tender) {
      return res
        .status(404)
        .json({ success: false, message: "Tender not found" });
    }

    const docTasks = await TenderDocumentTask.find({ tenderId: tender._id })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    const deadlineDays = tender.lastDateOfSubmission
      ? Math.max(
        0,
        Math.ceil(
          (new Date(tender.lastDateOfSubmission).getTime() - Date.now()) /
          86400000
        )
      )
      : 0;

    /* ---------- Bid summary ---------- */
    const bidValue = Number(tender.bidValue) || 0;
    const tenderSecurity = Number(tender.tenderSecurityAmount) || 0;
    const performanceSecurity = Number(tender.performanceSecurityAmount) || 0;
    const performanceSecurityPercent = bidValue
      ? Math.round((performanceSecurity / bidValue) * 100)
      : 0;

    /* ---------- Documents submitted (attachments) ---------- */
    const documentsSubmitted = (tender.attachments ?? []).map((a) => ({
      id: String(a._id),
      name: a.name,
      url: a.url ?? "",
      size: a.size ?? 0,
      mimeType: a.mimeType ?? "",
    }));

    /* ---------- Other participants (competitors) ---------- */
    const otherParticipants = (tender.otherParticipants ?? []).map((p) => ({
      bidder: p.bidder,
      value: Number(p.value) || 0,
      isUs: !!p.isUs,
    }));

    res.json({
      success: true,
      data: {
        id: tender._id,
        tenderer: tender.tenderer,
        title: tender.title,
        deadlineDays,
        readiness: tender.readiness ?? 0,

        /* ✅ Bid summary */
        bidSummary: {
          ourBidValue: bidValue,
          tenderSecurity,
          performanceSecurity,
          performanceSecurityPercent,
          currency: tender.currency || "BDT",
        },

        /* ✅ Other participants table */
        otherParticipants,

        /* ✅ Documents submitted (right panel) */
        documentsSubmitted,

        docTasks: docTasks.map((t) => ({
          id: t._id,
          title: t.title,
          owner: t.owner,
          fileName: t.fileName,
          fileUrl: t.fileUrl ?? "",
          status: t.status,
        })),

        checklist: buildChecklist(tender, docTasks),

        info: {
          advertisementFile: tender.advertisementFile,
          advertisementUrl: tender.advertisementUrl ?? "",
          advertisementUploadedBy: tender.advertisementUploadedBy,
          advertisementUploadedAt: tender.advertisementUploadedAt,
          tenderLink: tender.tenderLink,
          recordedBy: tender.recordedBy,
          tenderType: tender.tenderType,
          responsiblePerson: tender.responsiblePerson,
          lastDateOfPurchase: tender.lastDateOfPurchase
            ? new Date(tender.lastDateOfPurchase).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
            : undefined,
          lastDateOfSubmission: tender.lastDateOfSubmission
            ? new Date(tender.lastDateOfSubmission).toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
            : undefined,
          note: tender.note,
          attachments: (tender.attachments ?? []).map((a) => ({
            _id: String(a._id),
            name: a.name,
            url: a.url,
            size: a.size,
            mimeType: a.mimeType,
          })),
          eligibility: tender.eligibility,
        },
      },
    });
  } catch (error) {
    console.error("getSubmissionDetail error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { listSubmissions, getSubmissionDetail };