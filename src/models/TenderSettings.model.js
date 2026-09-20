// src/models/TenderSettings.model.js
const mongoose = require("mongoose");

const TenderSettingsSchema = new mongoose.Schema(
    {
        /* Single-document store — only one row exists */
        sectors: { type: [String], default: [] },
        customSectors: { type: [String], default: [] },
        productLines: { type: [String], default: [] },
        customProductLines: { type: [String], default: [] },

        valueMin: { type: Number, default: null },
        valueMax: { type: Number, default: null },
        securityMin: { type: Number, default: null },
        securityMax: { type: Number, default: null },
        performanceMin: { type: Number, default: null },
        performanceMax: { type: Number, default: null },

        tenderTypes: { type: [String], default: [] },
        customTenderTypes: { type: [String], default: [] },

        crawlTime: { type: String, default: "06:00" },

        /* Notification recipients */
        notificationRecipientIds: [
            { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        ],

        /* Last crawl summary */
        lastCrawl: {
            at: { type: String, default: "" },
            sitesChecked: { type: Number, default: 0 },
            newFound: { type: Number, default: 0 },
            matched: { type: Number, default: 0 },
            ranAt: { type: Date, default: null },
            triggeredBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null,
            },
        },

        /* Tracking */
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true },
);

module.exports =
    mongoose.models.TenderSettings ||
    mongoose.model("TenderSettings", TenderSettingsSchema);