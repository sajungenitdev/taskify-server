// src/controllers/tender/settings.controller.js
const TenderSettings = require("../../models/TenderSettings.model");
const SiteSource = require("../../models/SiteSource.model");
const { runCrawlInternal } = require("../../services/crawlScheduler.service");
const { crawlOne } = require("../../services/tenderCrawler.service");

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
 * UPDATE
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
            "customRangeNote",
            "notificationRecipientIds",
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
 * GET LAST CRAWL
 * ============================================================ */
const getLastCrawl = async (_req, res) => {
    try {
        const doc = await TenderSettings.findOne().lean();
        res.json({ success: true, data: doc?.lastCrawl ?? null });
    } catch (error) {
        console.error("getLastCrawl error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/* ============================================================
 * RUN CRAWL — HTTP handler (delegates to the shared service)
 * ============================================================ */
const runCrawl = async (req, res) => {
    try {
        const result = await runCrawlInternal({ userId: req.user?._id || null });
        res.json({
            success: true,
            message: "Crawl complete",
            data: result,
        });
    } catch (error) {
        console.error("runCrawl error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/* ============================================================
 * SITE SOURCE CRUD
 * ============================================================ */
const listSites = async (_req, res) => {
    try {
        const sites = await SiteSource.find({}).sort({ name: 1 }).lean();
        res.json({ success: true, data: sites });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const createSite = async (req, res) => {
    try {
        const {
            name,
            url,
            listSelector,
            titleSelector,
            linkSelector,
            dateSelector,
            linkAttr,
        } = req.body;

        if (!name || !url || !listSelector) {
            return res.status(400).json({
                success: false,
                message: "name, url, and listSelector are required",
            });
        }

        const domain = (() => {
            try {
                return new URL(url).hostname;
            } catch {
                return "";
            }
        })();

        const site = await SiteSource.create({
            name,
            url,
            domain,
            listSelector,
            titleSelector: titleSelector || "td.title a",
            linkSelector: linkSelector || "td.title a",
            dateSelector: dateSelector || "td.date",
            linkAttr: linkAttr || "href",
            createdBy: req.user._id,
            updatedBy: req.user._id,
        });

        res.status(201).json({ success: true, data: site });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const updateSite = async (req, res) => {
    try {
        const site = await SiteSource.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedBy: req.user._id },
            { new: true },
        );
        if (!site) {
            return res.status(404).json({ success: false, message: "Site not found" });
        }
        res.json({ success: true, data: site });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const deleteSite = async (req, res) => {
    try {
        await SiteSource.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Site deleted" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/* Preview: fetch & parse without saving */
const previewSite = async (req, res) => {
    try {
        const {
            url,
            listSelector,
            titleSelector,
            linkSelector,
            dateSelector,
            linkAttr,
        } = req.body;

        if (!url || !listSelector) {
            return res.status(400).json({
                success: false,
                message: "url and listSelector are required",
            });
        }

        const tempSource = {
            _id: null,
            name: "Preview",
            url,
            listSelector,
            titleSelector: titleSelector || "td.title a",
            linkSelector: linkSelector || "td.title a",
            dateSelector: dateSelector || "td.date",
            linkAttr: linkAttr || "href",
            absoluteLinks: true,
        };

        const r = await crawlOne(tempSource);
        res.json({ success: r.ok, data: r });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = {
    getSettings,
    updateSettings,
    getLastCrawl,
    runCrawl,
    listSites,
    createSite,
    updateSite,
    deleteSite,
    previewSite,
};