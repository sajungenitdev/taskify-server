// src/models/Rfq.model.js
const mongoose = require("mongoose");

const RfqSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    reference: { type: String, default: "" },
    value: { type: Number, default: 0 },
    currency: {
      type: String,
      enum: ["BDT", "SAR", "USD", "AED", "INR", "EUR", "GBP"],
      default: "BDT",
      uppercase: true,
    },
    status: {
      type: String,
      enum: ["open", "submitted", "closed", "cancelled"],
      default: "open",
      index: true,
    },
    submittedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    dueAt: { type: Date, default: null },
    notes: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Rfq || mongoose.model("Rfq", RfqSchema);