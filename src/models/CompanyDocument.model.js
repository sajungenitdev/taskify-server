// src/models/CompanyDocument.model.js
const mongoose = require("mongoose");

const CompanyDocumentSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ["legal", "profiles", "experience", "certificates"],
      required: true,
      index: true,
    },

    /* ---------- Common fields ---------- */
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },         // profile description / generic doc notes
    reference: { type: String, default: "" },
    validity: { type: String, default: "" },            // free-text display ("Valid until 30 Jun 2028")
    validUntil: { type: Date, default: null, index: true },
    issuedOn: { type: Date, default: null },

    status: {
      type: String,
      enum: ["Valid", "Expiring Soon", "Expired"],
      default: "Valid",
      index: true,
    },
    action: {
      type: String,
      enum: ["View", "Replace", "Renew"],
      default: "View",
    },

    /* ---------- File metadata ---------- */
    fileUrl: { type: String, default: "" },
    fileName: { type: String, default: "" },
    fileSize: { type: Number, default: 0 },
    fileMime: { type: String, default: "" },
    docType: { type: String, default: "" },

    /* ---------- Experience-only fields ---------- */
    subtitle: { type: String, default: "" },            // legacy / experience
    chips: { type: [String], default: [] },             // ["Power & Energy", "3+ Yrs", "৳5L+"]

    /* ---------- Import tracking ---------- */
    importedInto: [
      {
        tenderId: { type: mongoose.Schema.Types.ObjectId, ref: "Tender" },
        importedAt: { type: Date, default: Date.now },
        importedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

/* ============================================================
 * INDEXES — tuned for the queries this app actually runs
 * ============================================================ */

// Primary listing: filter by category, sort by createdAt
CompanyDocumentSchema.index({ category: 1, createdAt: -1 });

// Status filters within a category
CompanyDocumentSchema.index({ category: 1, status: 1 });

// Expiry window queries (used by renew alerts)
CompanyDocumentSchema.index({ category: 1, validUntil: 1 });
CompanyDocumentSchema.index({ status: 1, validUntil: 1 });

// Search
CompanyDocumentSchema.index({ title: "text", description: "text", reference: "text" });

// Chip-filtered lists (experience page)
CompanyDocumentSchema.index({ category: 1, chips: 1, createdAt: -1 });

/* ============================================================
 * PRE-SAVE — keep status/action in sync with validUntil
 * ============================================================ */
CompanyDocumentSchema.pre("save", function (next) {
  if (this.validUntil) {
    const now = Date.now();
    const diffDays = Math.ceil(
      (this.validUntil.getTime() - now) / 86400000,
    );

    if (diffDays < 0) {
      this.status = "Expired";
      this.action = "Renew";
    } else if (diffDays <= 30) {
      this.status = "Expiring Soon";
      this.action = "Renew";
    } else {
      this.status = "Valid";
      if (this.action === "Renew") this.action = "View";
    }
  }
  next();
});

module.exports =
  mongoose.models.CompanyDocument ||
  mongoose.model("CompanyDocument", CompanyDocumentSchema);