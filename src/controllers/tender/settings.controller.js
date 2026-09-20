// src/controllers/tender/settings.controller.js
const TenderSettings = require("../../models/TenderSettings.model");
const Tender = require("../../models/Tender.model");
const { User } = require("../../models/User.model");           // ← FIXED
const { sendCrawlSummary } = require("../../utils/mailer");

/* ============================================================
 * GET — one settings doc, or defaults
 * ============================================================ */
const getSettings = async (_req, res) => {
  try {
    let doc = await TenderSettings.findOne().lean();
    if (!doc) {
      const created = await TenderSettings.create({});
      doc = created.toObject();
    }
    res.json({ success: true, data: doc });
  } catch (error) {
    console.error("getSettings error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * UPDATE — patch the single doc
 * ============================================================ */
const updateSettings = async (req, res) => {
  try {
    const allowed = [
      "sectors",
      "customSectors",
      "productLines",
      "customProductLines",
      "valueMin",
      "valueMax",
      "securityMin",
      "securityMax",
      "performanceMin",
      "performanceMax",
      "tenderTypes",
      "customTenderTypes",
      "crawlTime",
      "notificationRecipientIds",
      "customRangeNote",
    ];

    const patch = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    }
    patch.updatedBy = req.user._id;

    const doc = await TenderSettings.findOneAndUpdate({}, patch, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }).lean();

    res.json({ success: true, data: doc });
  } catch (error) {
    console.error("updateSettings error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * GET LAST CRAWL — return last run info
 * ============================================================ */
const getLastCrawl = async (_req, res) => {
  try {
    const doc = await TenderSettings.findOne().lean();
    res.json({
      success: true,
      data: doc?.lastCrawl ?? null,
    });
  } catch (error) {
    console.error("getLastCrawl error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * RUN CRAWL — triggers the daily tender search immediately
 *
 * Flow:
 *   1. Read criteria from TenderSettings
 *   2. Load recipient emails from notificationRecipientIds
 *   3. Run the crawl (stub — replace with real logic)
 *   4. Save summary in TenderSettings.lastCrawl
 *   5. Email recipients with a summary
 * ============================================================ */
const runCrawl = async (req, res) => {
  try {
    /* 1. Load criteria */
    let settings = await TenderSettings.findOne();
    if (!settings) settings = await TenderSettings.create({});

    /* 2. Load recipient emails */
    let recipients = [];
    try {
      if (Array.isArray(settings.notificationRecipientIds) &&
          settings.notificationRecipientIds.length > 0) {
        recipients = await User.find({
          _id: { $in: settings.notificationRecipientIds },
        })
          .select("email fullName")
          .lean();
      }
    } catch (err) {
      console.warn("[runCrawl] recipient lookup failed:", err.message);
      recipients = [];
    }

    /* 3. Run the actual crawl
     * ─────────────────────────────────────────────────────────────
     * TODO: replace this stub with your real crawl logic.
     * For now we simulate a crawl result so the flow works end-to-end.
     */
    const startedAt = new Date();
    const sitesChecked = 14;
    const newFound = Math.floor(Math.random() * 5);   // 0..4 simulated
    const matched = Math.min(newFound, Math.floor(Math.random() * 3) + 1);
    const at = startedAt.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    /* 4. Save summary on the settings doc */
    settings.lastCrawl = {
      at,
      sitesChecked,
      newFound,
      matched,
      ranAt: startedAt,
      triggeredBy: req.user?._id || null,
    };
    await settings.save();

    /* 5. Email recipients (if any + if matched > 0) */
    let emailed = 0;
    if (recipients.length > 0 && matched > 0) {
      try {
        const info = await sendCrawlSummary({
          to: recipients.map((r) => r.email),
          summary: { sitesChecked, newFound, matched },
          criteria: {
            sectors: settings.sectors,
            productLines: settings.productLines,
            valueMin: settings.valueMin,
            valueMax: settings.valueMax,
          },
          ranAt: at,
        });
        emailed = info?.accepted?.length ?? recipients.length;
      } catch (mailErr) {
        console.warn("[runCrawl] crawl email failed:", mailErr.message);
        /* Don't fail the whole crawl if mail fails */
      }
    }

    console.log(
      `[runCrawl] ✅ sites=${sitesChecked} new=${newFound} matched=${matched} emailed=${emailed}`,
    );

    res.json({
      success: true,
      message: "Crawl complete",
      data: {
        at,
        sitesChecked,
        newFound,
        matched,
        emailed,
      },
    });
  } catch (error) {
    console.error("runCrawl error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getSettings,
  updateSettings,
  getLastCrawl,
  runCrawl,
};