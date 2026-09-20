// src/models/SiteSource.model.js
const mongoose = require("mongoose");

const SiteSourceSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },      // "BPDB"
        url: { type: String, required: true, trim: true },       // "https://bpdbbd.org/tenders"
        domain: { type: String, default: "" },                   // auto-extracted

        /* CSS selectors for this specific site's HTML layout */
        listSelector: { type: String, required: true },          // "table.tenders tr"
        titleSelector: { type: String, default: "td.title a" },
        linkSelector: { type: String, default: "td.title a" },
        dateSelector: { type: String, default: "td.date" },
        linkAttr: { type: String, default: "href" },

        absoluteLinks: { type: Boolean, default: true },

        active: { type: Boolean, default: true, index: true },

        /* Crawl stats */
        lastCrawledAt: { type: Date, default: null },
        lastCrawlStatus: {
            type: String,
            enum: ["idle", "success", "error", ""],
            default: "idle",
        },
        lastCrawlError: { type: String, default: "" },
        lastItemCount: { type: Number, default: 0 },

        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        renderMode: {
            type: String,
            enum: ["cheerio", "puppeteer"],
            default: "cheerio",
        },
    },
    { timestamps: true },
);

module.exports =
    mongoose.models.SiteSource ||
    mongoose.model("SiteSource", SiteSourceSchema);