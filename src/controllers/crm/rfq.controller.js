// src/controllers/crm/rfq.controller.js
const Rfq = require("../../models/Rfq.model");
const Client = require("../../models/Client.model");
const {
    canAccessRecord,
    scopeFilter,
} = require("../../middleware/crm.permissions");

// ============================================================
// LIST RFQs for a client
// ============================================================
const listClientRfqs = async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);
        if (!client)
            return res.status(404).json({ success: false, message: "Client not found" });
        if (!canAccessRecord(req.user, client))
            return res.status(403).json({ success: false, message: "Not authorized" });

        const rfqs = await Rfq.find({ clientId: client._id })
            .sort({ createdAt: -1 })
            .lean();

        res.json({ success: true, data: rfqs });
    } catch (error) {
        console.error("listClientRfqs error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// CREATE RFQ for a client
// ============================================================
const createRfq = async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);
        if (!client)
            return res.status(404).json({ success: false, message: "Client not found" });
        if (!canAccessRecord(req.user, client))
            return res.status(403).json({ success: false, message: "Not authorized" });

        const { title, reference, value, currency, status, dueAt, notes } = req.body;
        if (!title?.trim())
            return res.status(400).json({ success: false, message: "title is required" });

        const rfq = await Rfq.create({
            clientId: client._id,
            title: title.trim(),
            reference: reference || "",
            value: Number(value) || 0,
            currency: currency || "BDT",
            status: status || "open",
            dueAt: dueAt ? new Date(dueAt) : null,
            notes: notes || "",
            createdBy: req.user._id,
        });

        res.status(201).json({ success: true, data: rfq });
    } catch (error) {
        console.error("createRfq error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// UPDATE RFQ (status, submission, close)
// ============================================================
const updateRfq = async (req, res) => {
    try {
        const rfq = await Rfq.findById(req.params.id);
        if (!rfq)
            return res.status(404).json({ success: false, message: "RFQ not found" });

        const client = await Client.findById(rfq.clientId);
        if (!client || !canAccessRecord(req.user, client))
            return res.status(403).json({ success: false, message: "Not authorized" });

        const { title, reference, value, currency, status, dueAt, notes } = req.body;

        if (title !== undefined) rfq.title = title;
        if (reference !== undefined) rfq.reference = reference;
        if (value !== undefined) rfq.value = Number(value);
        if (currency !== undefined) rfq.currency = currency;
        if (dueAt !== undefined) rfq.dueAt = dueAt ? new Date(dueAt) : null;
        if (notes !== undefined) rfq.notes = notes;

        if (status !== undefined) {
            rfq.status = status;
            if (status === "submitted" && !rfq.submittedAt) rfq.submittedAt = new Date();
            if (status === "closed" || status === "cancelled") rfq.closedAt = new Date();
        }

        await rfq.save();
        res.json({ success: true, data: rfq });
    } catch (error) {
        console.error("updateRfq error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// DELETE RFQ
// ============================================================
const deleteRfq = async (req, res) => {
    try {
        const rfq = await Rfq.findById(req.params.id);
        if (!rfq)
            return res.status(404).json({ success: false, message: "RFQ not found" });

        const client = await Client.findById(rfq.clientId);
        if (!client || !canAccessRecord(req.user, client))
            return res.status(403).json({ success: false, message: "Not authorized" });

        await rfq.deleteOne();
        res.json({ success: true, message: "RFQ deleted" });
    } catch (error) {
        console.error("deleteRfq error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// GLOBAL RFQ LIST (all clients, filtered)
// ============================================================
const listAllRfqs = async (req, res) => {
    try {
        const { status, page = 1, limit = 50 } = req.query;
        const query = {};
        if (status && status !== "all") query.status = status;

        const [rfqs, total] = await Promise.all([
            Rfq.find(query)
                .populate("clientId", "name sector stage assignedRep")
                .populate("createdBy", "fullName email")
                .sort({ createdAt: -1 })
                .skip((parseInt(page) - 1) * parseInt(limit))
                .limit(parseInt(limit))
                .lean(),
            Rfq.countDocuments(query),
        ]);

        res.json({
            success: true,
            data: rfqs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        console.error("listAllRfqs error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    listClientRfqs,
    createRfq,
    updateRfq,
    deleteRfq,
    listAllRfqs,
};