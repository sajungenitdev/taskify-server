// src/controllers/tender/security.controller.js
const TenderSecurity = require("../../models/TenderSecurity.model");

/* ============================================================
 * LIST — with entity, type, docs filters
 * ============================================================ */
const listSecurity = async (req, res) => {
  try {
    const { entity, type, docs, page = 1, limit = 100 } = req.query;

    const query = {};
    if (entity && entity !== "all") query.entity = entity;
    if (type && type !== "all") query.type = type;
    if (docs && docs !== "all") query.docsStatus = docs;

    const [rows, total] = await Promise.all([
      TenderSecurity.find(query)
        .sort({ dueDate: 1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .lean(),
      TenderSecurity.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("listSecurity error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * STATS — for the 4 stat tiles
 * ============================================================ */
const securityStats = async (_req, res) => {
  try {
    const [agg] = await TenderSecurity.aggregate([
      {
        $group: {
          _id: null,
          totalPending: { $sum: "$amount" },
          entities: { $addToSet: "$entity" },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        totalPending: agg?.totalPending ?? 0,
        entitiesAffected: agg?.entities?.length ?? 0,
        receivableOutstanding: 0,
        payableOutstanding: 0,
      },
    });
  } catch (error) {
    console.error("securityStats error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * CREATE
 * ============================================================ */
const createSecurity = async (req, res) => {
  try {
    const {
      entity,
      clientDescription,
      type,
      amount,
      currency,
      dueDate,
      docsStatus,
      documentUrl,
      tenderId,
    } = req.body;

    if (!entity || !clientDescription || !type) {
      return res
        .status(400)
        .json({
          success: false,
          message: "entity, clientDescription, and type are required",
        });
    }

    const row = await TenderSecurity.create({
      entity,
      clientDescription,
      type,
      amount: Number(amount) || 0,
      currency: currency || "BDT",
      dueDate: dueDate ? new Date(dueDate) : null,
      docsStatus: docsStatus || "Missing",
      documentUrl: documentUrl || "",
      tenderId: tenderId || null,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    res.status(201).json({ success: true, data: row });
  } catch (error) {
    console.error("createSecurity error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * UPDATE
 * ============================================================ */
const updateSecurity = async (req, res) => {
  try {
    const row = await TenderSecurity.findById(req.params.id);
    if (!row) {
      return res
        .status(404)
        .json({ success: false, message: "Security record not found" });
    }

    const allowed = [
      "entity",
      "clientDescription",
      "type",
      "amount",
      "currency",
      "dueDate",
      "docsStatus",
      "documentUrl",
    ];
    for (const k of allowed) {
      if (req.body[k] !== undefined) row[k] = req.body[k];
    }
    row.updatedBy = req.user._id;
    await row.save();

    res.json({ success: true, data: row });
  } catch (error) {
    console.error("updateSecurity error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ============================================================
 * DELETE
 * ============================================================ */
const deleteSecurity = async (req, res) => {
  try {
    const row = await TenderSecurity.findByIdAndDelete(req.params.id);
    if (!row) {
      return res
        .status(404)
        .json({ success: false, message: "Security record not found" });
    }
    res.json({ success: true, message: "Security record deleted" });
  } catch (error) {
    console.error("deleteSecurity error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  listSecurity,
  securityStats,
  createSecurity,
  updateSecurity,
  deleteSecurity,
};