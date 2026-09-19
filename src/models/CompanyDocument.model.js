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

    /* ---------- Legal / certificate fields ---------- */
    title: { type: String, required: true, trim: true },
    reference: { type: String, default: "" },
    validity: { type: String, default: "" },              // free-text display
    validUntil: { type: Date, default: null, index: true }, // ← NEW — real expiry date
    issuedOn: { type: Date, default: null },                // ← NEW — optional issue date
    status: {
      type: String,
      enum: ["Valid", "Expiring Soon", "Expired"],
      default: "Valid",
      index: true,
    },
    action: {
      type: String,
      enum: ["View", "Replace", "Renew"],                    // ← NEW: "Renew"
      default: "View",
    },

    /* ---------- File fields ---------- */
    fileUrl: { type: String, default: "" },
    fileName: { type: String, default: "" },
    fileSize: { type: Number, default: 0 },
    fileMime: { type: String, default: "" },
    docType: { type: String, default: "" },

    /* ---------- Experience card fields ---------- */
    subtitle: { type: String, default: "" },
    chips: [{ type: String }], // ["Power & Energy", "3+ Yrs", "৳5L+"]

    /* ---------- Tracking ---------- */
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

CompanyDocumentSchema.index({ title: "text", reference: "text" });
CompanyDocumentSchema.index({ category: 1, validUntil: 1 });     // ← NEW
CompanyDocumentSchema.index({ status: 1, validUntil: 1 });       // ← NEW

/* ============================================================
 * STATUS AUTO-COMPUTE
 * Runs before every save. If `validUntil` is set, `status` is
 * derived from it. If `validUntil` is null, `status` is left as-is.
 * ============================================================ */
CompanyDocumentSchema.pre("save", function (next) {
  if (this.validUntil) {
    const now = new Date();
    const diffDays = Math.ceil(
      (this.validUntil.getTime() - now.getTime()) / 86400000,
    );

    if (diffDays < 0) {
      this.status = "Expired";
      this.action = "Renew";
    } else if (diffDays <= 30) {
      this.status = "Expiring Soon";
      this.action = "Renew";
    } else {
      this.status = "Valid";
      // Keep whatever action was set; default to View if blank
      if (this.action === "Renew") this.action = "View";
    }
  }
  next();
});

module.exports =
  mongoose.models.CompanyDocument ||
  mongoose.model("CompanyDocument", CompanyDocumentSchema);