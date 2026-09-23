// src/models/SiteSource.model.js
const mongoose = require("mongoose");

const SiteSourceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    domain: { type: String, default: "" },

    /* CSS selectors */
    listSelector: { type: String, required: true },
    titleSelector: { type: String, default: "td.title a" },
    linkSelector: { type: String, default: "td.title a" },
    dateSelector: { type: String, default: "td.date" },
    linkAttr: { type: String, default: "href" },

    absoluteLinks: { type: Boolean, default: true },
    active: { type: Boolean, default: true, index: true },
    renderMode: {
      type: String,
      enum: ["cheerio", "puppeteer"],
      default: "cheerio",
    },

    /* ============ Site Directory fields (new) ============ */
    sector: {
      type: String,
      enum: ["banks", "power", "oilgas", "govt"],
      default: "banks",
      index: true,
    },
    portalUrl: { type: String, default: "" },

    /* Popular Tenderers sidebar */
    popular: { type: Boolean, default: false, index: true },
    popularShort: { type: String, default: "" },
    popularColor: { type: String, default: "" },
    popularSubtitle: { type: String, default: "" },

    /* Info modal */
    siteInfoSector: { type: String, default: "" },
    siteInfoPortalType: { type: String, default: "" },
    siteInfoContact: { type: String, default: "" },

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
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.SiteSource ||
  mongoose.model("SiteSource", SiteSourceSchema);