// src/routes/tender.routes.js
const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth.middleware");

const tenderCtrl = require("../controllers/tender/tender.controller");
const submissionCtrl = require("../controllers/tender/submission.controller");
const securityCtrl = require("../controllers/tender/security.controller");
const docCtrl = require("../controllers/tender/companyDoc.controller");
const overviewCtrl = require("../controllers/tender/overview.controller");

const {
    tenderUpload,
    advertisementUpload,
    companyDocUpload,
} = require("../middleware/upload.middleware");

router.use(authenticate);

/* ============================================================
 * STATIC ROUTES — before any /:id
 * ============================================================ */
router.get("/overview", overviewCtrl.overview);
router.get("/overview/upcoming", overviewCtrl.upcomingDeadlines);
router.get("/overview/performance", overviewCtrl.performance);
router.get("/overview/recent-activity", overviewCtrl.recentActivity);

router.get("/submissions/list", submissionCtrl.listSubmissions);
router.get("/submissions/:id", submissionCtrl.getSubmissionDetail);

router.get("/security/list", securityCtrl.listSecurity);
router.get("/security/stats", securityCtrl.securityStats);
router.post("/security", securityCtrl.createSecurity);
router.patch("/security/:id", securityCtrl.updateSecurity);
router.delete("/security/:id", securityCtrl.deleteSecurity);

router.get("/docs/list", docCtrl.listDocs);
router.get("/docs/counts", docCtrl.docCounts);
router.post("/docs/import", docCtrl.importDocsToTender);
router.post("/docs", docCtrl.createDoc);
router.patch("/docs/:id", docCtrl.updateDoc);
router.delete("/docs/:id", docCtrl.deleteDoc);

/* ---------- Company doc file upload ---------- */
router.post(
    "/docs/:id/file",
    companyDocUpload.single("file"),
    docCtrl.uploadDocFile,
);

/* ============================================================
 * TENDER CRUD
 * ============================================================ */
router.get("/", tenderCtrl.listTenders);
router.post("/", tenderCtrl.createTender);

/* ============================================================
 * SCOPED /:id ROUTES — must come BEFORE the generic /:id
 * ============================================================ */

/* ---------- DOC TASKS ---------- */
router.post("/:id/doc-tasks", tenderCtrl.addDocTask);
router.patch("/:id/doc-tasks/:taskId", tenderCtrl.updateDocTask);
router.delete("/:id/doc-tasks/:taskId", tenderCtrl.deleteDocTask);

/* ---------- CHECKLIST ---------- */
router.patch("/:id/checklist", tenderCtrl.updateChecklist);

/* ---------- ATTACHMENTS ---------- */
router.post(
    "/:id/attachments",
    tenderUpload.single("file"),
    tenderCtrl.uploadAttachment,
);
router.delete("/:id/attachments/:attachmentId", tenderCtrl.deleteAttachment);

/* ---------- ADVERTISEMENT ---------- */
router.post(
    "/:id/advertisement",
    advertisementUpload.single("file"),
    tenderCtrl.uploadAdvertisement,
);
router.delete("/:id/advertisement", tenderCtrl.deleteAdvertisement);

/* ============================================================
 * GENERIC /:id — LAST
 * ============================================================ */
router.get("/:id", tenderCtrl.getTender);
router.put("/:id", tenderCtrl.updateTender);
router.patch("/:id/stage", tenderCtrl.changeStage);
router.delete("/:id", tenderCtrl.deleteTender);

module.exports = router;