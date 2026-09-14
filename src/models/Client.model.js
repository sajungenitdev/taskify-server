// src/models/Client.model.js
const mongoose = require("mongoose");

const VisitSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    purpose: { type: String, default: "" },
    notes: { type: String, default: "" },
    location: { type: String, default: "" },
  },
  { _id: true }
);

const ClientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sector: { type: String, default: "" }, // "Govt / Energy", "Private / IT"
    location: { type: String, default: "" },
    city: { type: String, default: "" },
    country: { type: String, default: "Bangladesh" },

    stage: {
      type: String,
      enum: ["hot", "warm", "won", "cold"],
      default: "cold",
      index: true,
    },

    assignedRep: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    // Visit history
    lastVisitAt: { type: Date, default: null },
    visitsPerMonth: { type: Number, default: 0 },
    visitLog: [VisitSchema],

    // Next action
    nextAction: {
      label: { type: String, default: "" },
      dueAt: { type: Date, default: null },
      isOverdue: { type: Boolean, default: false },
    },

    // Linked data
    projectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Project" }],
    contactIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Contact" }],

    notes: { type: String, default: "", maxlength: 2000 },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

ClientSchema.index({ name: "text", sector: "text", location: "text" });

// Virtual: open RFQ count
ClientSchema.virtual("openRfqCount", {
  ref: "Rfq",
  localField: "_id",
  foreignField: "clientId",
  count: true,
  match: { status: "open" },
});

ClientSchema.set("toJSON", { virtuals: true });
ClientSchema.set("toObject", { virtuals: true });

module.exports =
  mongoose.models.Client || mongoose.model("Client", ClientSchema);