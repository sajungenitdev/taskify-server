// src/routes/crm.routes.js
const express = require("express");
const router = express.Router();

const { authenticate } = require("../middleware/auth.middleware");

const contactCtrl = require("../controllers/crm/contact.controller");
const leadCtrl = require("../controllers/crm/lead.controller");
const activityCtrl = require("../controllers/crm/activity.controller");
const clientCtrl = require("../controllers/crm/client.controller");
const rfqCtrl = require("../controllers/crm/rfq.controller");
const analyticsCtrl = require("../controllers/crm/analytics.controller");
const stageConfigCtrl = require("../controllers/crm/stageConfig.controller");

// ============================================================
// Auth — every CRM route requires a logged-in user
// ============================================================
router.use(authenticate);

// ============================================================
// DEAL STAGE CONFIG
// ============================================================
router.get("/stages", stageConfigCtrl.listStages);
router.post("/stages", stageConfigCtrl.upsertStage);

// ============================================================
// CONTACTS
// ============================================================
router.get("/contacts", contactCtrl.listContacts);
router.post("/contacts", contactCtrl.createContact);
router.get("/contacts/:id", contactCtrl.getContact);
router.put("/contacts/:id", contactCtrl.updateContact);
router.delete("/contacts/:id", contactCtrl.deleteContact);

// ============================================================
// LEADS / DEALS
// ============================================================
router.get("/leads", leadCtrl.listLeads);
router.post("/leads", leadCtrl.createLead);
router.get("/leads/:id", leadCtrl.getLead);
router.put("/leads/:id", leadCtrl.updateLead);
router.patch("/leads/:id/stage", leadCtrl.changeStage);
router.post("/leads/:id/convert-to-project", leadCtrl.convertToProject);
router.post("/leads/:id/rescore", leadCtrl.rescoreLead);
router.post("/leads/:id/schedule-follow-up", leadCtrl.scheduleFollowUp);
router.delete("/leads/:id", leadCtrl.deleteLead);

// ============================================================
// ACTIVITIES
// ============================================================
router.get("/leads/:id/activities", activityCtrl.listActivities);
router.post("/leads/:id/activities", activityCtrl.createActivity);
router.patch("/activities/:id", activityCtrl.updateActivity);
router.delete("/activities/:id", activityCtrl.deleteActivity);
router.get("/activities/my-feed", activityCtrl.myActivityFeed);

// ============================================================
// CLIENTS
// ============================================================
router.get("/clients", clientCtrl.listClients);
router.post("/clients", clientCtrl.createClient);
router.get("/clients/:id", clientCtrl.getClient);
router.put("/clients/:id", clientCtrl.updateClient);
router.post("/clients/:id/visits", clientCtrl.logVisit);
router.delete("/clients/:id", clientCtrl.deleteClient);

// ============================================================
// RFQs
// ============================================================
router.get("/rfqs", rfqCtrl.listAllRfqs);
router.get("/clients/:id/rfqs", rfqCtrl.listClientRfqs);
router.post("/clients/:id/rfqs", rfqCtrl.createRfq);
router.patch("/rfqs/:id", rfqCtrl.updateRfq);
router.delete("/rfqs/:id", rfqCtrl.deleteRfq);

// ============================================================
// ANALYTICS
// ============================================================
router.get("/forecast", analyticsCtrl.forecast);
router.get("/leaderboard", analyticsCtrl.leaderboard);
router.get("/pipeline/summary", analyticsCtrl.pipelineSummary);
router.get("/dashboard/stats", analyticsCtrl.dashboardStats);
router.get("/kpi/snapshot", analyticsCtrl.kpiSnapshot);

module.exports = router;