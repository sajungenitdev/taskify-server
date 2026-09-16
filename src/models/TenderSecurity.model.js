// src/models/TenderSecurity.model.js
const mongoose = require("mongoose");

const TenderSecuritySchema = new mongoose.Schema(
  {
    entity: {
      type: String,
      required: true,
      trim: true,
      index: true, // "NGL-26" | "NG-26" | "JT" | ...
    },
    clientDescription: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["Tender Security", "Performance Security", "Bank Guarantee"],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      enum: ["BDT", "USD", "SAR", "AED", "INR", "EUR", "GBP"],
      default: "BDT",
    },
    dueDate: { type: Date, default: null, index: true },
    docsStatus: {
      type: String,
      enum: ["Attached", "Missing"],
      default: "Missing",
      index: true,
    },
    documentUrl: { type: String, default: "" },
    tenderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tender",
      default: null,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.TenderSecurity ||
  mongoose.model("TenderSecurity", TenderSecuritySchema);