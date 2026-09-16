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
    validity: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Valid", "Expiring Soon", "Expired"],
      default: "Valid",
      index: true,
    },
    action: {
      type: String,
      enum: ["View", "Replace"],
      default: "View",
    },
    fileUrl: { type: String, default: "" },

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
  { timestamps: true }
);

CompanyDocumentSchema.index({ title: "text", reference: "text" });

module.exports =
  mongoose.models.CompanyDocument ||
  mongoose.model("CompanyDocument", CompanyDocumentSchema);