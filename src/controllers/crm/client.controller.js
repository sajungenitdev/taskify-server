// src/controllers/crm/client.controller.js
const Client = require("../../models/Client.model");
const Rfq = require("../../models/Rfq.model");
const Lead = require("../../models/Lead.model");
const {
    scopeFilter,
    canAccessRecord,
} = require("../../middleware/crm.permissions");

// ============================================================
// LIST
// ============================================================
const listClients = async (req, res) => {
    try {
        const { sector, stage, search, page = 1, limit = 50 } = req.query;

        const query = { isActive: true, ...scopeFilter(req.user, "assignedRep") };
        if (sector && sector !== "all") query.sector = sector;
        if (stage && stage !== "all") query.stage = stage;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { location: { $regex: search, $options: "i" } },
                { city: { $regex: search, $options: "i" } },
            ];
        }

        const [clients, total] = await Promise.all([
            Client.find(query)
                .populate("assignedRep", "fullName email")
                .sort({ updatedAt: -1 })
                .skip((parseInt(page) - 1) * parseInt(limit))
                .limit(parseInt(limit))
                .lean(),
            Client.countDocuments(query),
        ]);

        // Attach open RFQ count for each
        const ids = clients.map((c) => c._id);
        const rfqCounts = await Rfq.aggregate([
            { $match: { clientId: { $in: ids }, status: "open" } },
            { $group: { _id: "$clientId", count: { $sum: 1 } } },
        ]);
        const rfqMap = Object.fromEntries(rfqCounts.map((r) => [String(r._id), r.count]));

        const enriched = clients.map((c) => ({
            ...c,
            openRfqCount: rfqMap[String(c._id)] || 0,
        }));

        res.json({
            success: true,
            data: enriched,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        console.error("listClients error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// GET ONE (with visits + RFQs + linked leads)
// ============================================================
const getClient = async (req, res) => {
    try {
        const client = await Client.findById(req.params.id)
            .populate("assignedRep", "fullName email")
            .populate("visitLog.by", "fullName email")
            .populate("projectIds", "name code status")
            .populate("contactIds", "name email phone tag")
            .lean();

        if (!client)
            return res.status(404).json({ success: false, message: "Client not found" });

        if (!canAccessRecord(req.user, client))
            return res.status(403).json({ success: false, message: "Not authorized" });

        const [rfqs, leads] = await Promise.all([
            Rfq.find({ clientId: client._id }).sort({ createdAt: -1 }).lean(),
            Lead.find({ clientId: client._id })
                .select("companyName stage value currency probability owner")
                .populate("owner", "fullName")
                .lean(),
        ]);

        res.json({ success: true, data: { ...client, rfqs, leads } });
    } catch (error) {
        console.error("getClient error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// CREATE
// ============================================================
const createClient = async (req, res) => {
    try {
        const {
            name,
            sector,
            location,
            city,
            country,
            stage,
            assignedRep,
            notes,
            departmentId,
            contactIds,
        } = req.body;

        if (!name?.trim())
            return res.status(400).json({ success: false, message: "name is required" });

        const client = await Client.create({
            name: name.trim(),
            sector: sector || "",
            location: location || "",
            city: city || "",
            country: country || "Bangladesh",
            stage: stage || "cold",
            assignedRep: assignedRep || req.user._id,
            notes: notes || "",
            departmentId: departmentId || req.user.departmentId,
            contactIds: Array.isArray(contactIds) ? contactIds : [],
            createdBy: req.user._id,
            updatedBy: req.user._id,
        });

        res.status(201).json({ success: true, data: client });
    } catch (error) {
        console.error("createClient error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// UPDATE
// ============================================================
const updateClient = async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);
        if (!client)
            return res.status(404).json({ success: false, message: "Client not found" });
        if (!canAccessRecord(req.user, client))
            return res.status(403).json({ success: false, message: "Not authorized" });

        const allowed = [
            "name",
            "sector",
            "location",
            "city",
            "country",
            "stage",
            "assignedRep",
            "notes",
            "departmentId",
            "contactIds",
            "nextAction",
        ];
        for (const k of allowed) {
            if (req.body[k] !== undefined) client[k] = req.body[k];
        }
        client.updatedBy = req.user._id;
        await client.save();

        res.json({ success: true, data: client });
    } catch (error) {
        console.error("updateClient error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// LOG A VISIT
//  - pushes to visitLog, updates lastVisitAt + visitsPerMonth
// ============================================================
const logVisit = async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);
        if (!client)
            return res.status(404).json({ success: false, message: "Client not found" });
        if (!canAccessRecord(req.user, client))
            return res.status(403).json({ success: false, message: "Not authorized" });

        const { at, purpose, notes, location } = req.body;

        const visitAt = at ? new Date(at) : new Date();
        client.visitLog.push({
            at: visitAt,
            by: req.user._id,
            purpose: purpose || "",
            notes: notes || "",
            location: location || client.location || "",
        });
        client.lastVisitAt = visitAt;

        // Recompute visitsPerMonth (last 30 days)
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        client.visitsPerMonth = client.visitLog.filter(
            (v) => new Date(v.at) >= cutoff
        ).length;

        client.updatedBy = req.user._id;
        await client.save();

        res.status(201).json({ success: true, data: client });
    } catch (error) {
        console.error("logVisit error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// DELETE (soft)
// ============================================================
const deleteClient = async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);
        if (!client)
            return res.status(404).json({ success: false, message: "Client not found" });
        if (!canAccessRecord(req.user, client))
            return res.status(403).json({ success: false, message: "Not authorized" });

        client.isActive = false;
        client.updatedBy = req.user._id;
        await client.save();

        res.json({ success: true, message: "Client archived" });
    } catch (error) {
        console.error("deleteClient error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    listClients,
    getClient,
    createClient,
    updateClient,
    logVisit,
    deleteClient,
};