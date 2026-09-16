// src/models/Tender.model.js
const mongoose = require("mongoose");

const TenderSchema = new mongoose.Schema(
    {
        /* ---------- BASIC INFO ---------- */
        tenderer: { type: String, required: true, trim: true, index: true },
        title: { type: String, required: true, trim: true },

        /* ---------- LIFECYCLE STAGE ---------- */
        stage: {
            type: String,
            enum: ["potential", "active", "submitted", "lost", "won"],
            default: "potential",
            index: true,
        },

        /* ---------- TYPE ---------- */
        tenderType: {
            type: String,
            enum: ["eGP", "RFQ", "Hardcopy Ref."],
            default: "eGP",
        },

        /* ---------- METADATA ---------- */
        tenderLink: { type: String, default: "" },
        recordedBy: { type: String, default: "" },
        responsiblePerson: { type: String, default: "" },
        description: { type: String, default: "" },

        /* ---------- DATES ---------- */
        lastDateOfPurchase: { type: Date, default: null },
        lastDateOfSubmission: { type: Date, default: null },
        submittedAt: { type: Date, default: null },

        /* ---------- VALUE ---------- */
        tentativeBudget: { type: Number, default: 0 },
        bidValue: { type: Number, default: 0 },
        currency: {
            type: String,
            enum: ["BDT", "USD", "SAR", "AED", "INR", "EUR", "GBP"],
            default: "BDT",
        },

        /* ---------- SECURITY ---------- */
        tenderSecurityAmount: { type: Number, default: 0 },
        performanceSecurityAmount: { type: Number, default: 0 },
        securityMode: {
            type: String,
            enum: ["Online (eGP)", "Offline", "Bank Guarantee", ""],
            default: "",
        },

        /* ---------- SUBMISSION ---------- */
        submitted: { type: Boolean, default: false },
        mode: { type: String, default: "" }, // "eGP — Online", "Hardcopy Ref."
        readiness: { type: Number, default: 0, min: 0, max: 100 },
        docStatus: {
            type: String,
            enum: ["Docs pending", "Docs in progress", "Complete", "Banking docs pending", ""],
            default: "",
        },

        /* ---------- ADVERTISEMENT ---------- */
        advertisementFile: { type: String, default: "" },
        advertisementUploadedBy: { type: String, default: "" },
        advertisementUploadedAt: { type: Date, default: null },

        /* ---------- NOTES / ELIGIBILITY ---------- */
        note: { type: String, default: "" },
        eligibility: { type: String, default: "" },

        /* ---------- ATTACHMENTS ---------- */
        attachments: [
            {
                name: { type: String, required: true },
                url: { type: String, default: "" },
                uploadedAt: { type: Date, default: Date.now },
            },
        ],

        /* ---------- COMPETITORS (for Submitted tab) ---------- */
        otherParticipants: [
            {
                bidder: { type: String, required: true },
                value: { type: Number, default: 0 },
                isUs: { type: Boolean, default: false },
            },
        ],
        /* ---------- SUBMISSION CHECKLIST ---------- */
        checklist: [
            {
                id: { type: String, required: true },
                label: { type: String, required: true },
                checked: { type: Boolean, default: false },
                isCustom: { type: Boolean, default: false },
            },
        ],

        /* ---------- LOSS INFO (for Lost tab) ---------- */
        lossReason: { type: String, default: "" },
        lowestCompliantBidder: { type: String, default: "" },
        lowestCompliantValue: { type: Number, default: 0 },
        lostAt: { type: Date, default: null },

        /* ---------- RESPONSIBILITY ---------- */
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },

        /* ---------- AUDIT ---------- */
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

        /* ---------- STAGE HISTORY ---------- */
        stageHistory: [
            {
                from: { type: String },
                to: { type: String },
                at: { type: Date, default: Date.now },
                by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                note: { type: String, default: "" },
            },
        ],
    },
    { timestamps: true }
);

TenderSchema.index({ stage: 1, owner: 1 });
TenderSchema.index({ tenderer: "text", title: "text", description: "text" });

module.exports =
    mongoose.models.Tender || mongoose.model("Tender", TenderSchema);