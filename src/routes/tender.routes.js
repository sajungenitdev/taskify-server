// src/routes/tender.routes.js
const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth.middleware");

const tenderCtrl = require("../controllers/tender/tender.controller");
const submissionCtrl = require("../controllers/tender/submission.controller");
const securityCtrl = require("../controllers/tender/security.controller");
const docCtrl = require("../controllers/tender/companyDoc.controller");
const overviewCtrl = require("../controllers/tender/overview.controller");

router.use(authenticate);

/* ============================================================
 * STATIC ROUTES FIRST — must be declared before /:id
 * ============================================================ */

/* ---------- OVERVIEW ---------- */
router.get("/overview", overviewCtrl.overview);
router.get("/overview/upcoming", overviewCtrl.upcomingDeadlines);

/* ---------- SUBMISSIONS ---------- */
router.get("/submissions/list", submissionCtrl.listSubmissions);
router.get("/submissions/:id", submissionCtrl.getSubmissionDetail);

/* ---------- SECURITY ---------- */
router.get("/security/list", securityCtrl.listSecurity);
router.get("/security/stats", securityCtrl.securityStats);
router.post("/security", securityCtrl.createSecurity);
router.patch("/security/:id", securityCtrl.updateSecurity);
router.delete("/security/:id", securityCtrl.deleteSecurity);

/* ---------- COMPANY DOCS ---------- */
router.get("/docs/list", docCtrl.listDocs);
router.get("/docs/counts", docCtrl.docCounts);
router.post("/docs/import", docCtrl.importDocsToTender);
router.post("/docs", docCtrl.createDoc);
router.patch("/docs/:id", docCtrl.updateDoc);
router.delete("/docs/:id", docCtrl.deleteDoc);

/* ============================================================
 * TENDERS — parameterized routes come AFTER static ones
 * ============================================================ */
router.get("/", tenderCtrl.listTenders);
router.post("/", tenderCtrl.createTender);

/* Doc tasks: these are /:id/doc-tasks — MUST come before /:id */
router.post("/:id/doc-tasks", tenderCtrl.addDocTask);
router.patch("/:id/doc-tasks/:taskId", tenderCtrl.updateDocTask);
router.delete("/:id/doc-tasks/:taskId", tenderCtrl.deleteDocTask);

/* Now the generic /:id — last */
router.get("/:id", tenderCtrl.getTender);
router.put("/:id", tenderCtrl.updateTender);
router.patch("/:id/stage", tenderCtrl.changeStage);
router.delete("/:id", tenderCtrl.deleteTender);

module.exports = router;