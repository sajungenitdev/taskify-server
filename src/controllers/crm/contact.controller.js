// src/controllers/crm/contact.controller.js
const Contact = require("../../models/Contact.model");
const Lead = require("../../models/Lead.model");
const {
  scopeFilter,
  canAccessRecord,
} = require("../../middleware/crm.permissions");

// ============================================================
// LIST CONTACTS
// ============================================================
const listContacts = async (req, res) => {
  try {
    const { search, tag, owner, page = 1, limit = 50 } = req.query;

    const query = { isActive: true, ...scopeFilter(req.user, "owner") };

    if (tag && tag !== "all") query.tag = tag;
    if (owner) query.owner = owner;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const [contacts, total] = await Promise.all([
      Contact.find(query)
        .populate("owner", "fullName email")
        .populate("leadId", "stage value currency")
        .sort({ updatedAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .lean(),
      Contact.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: contacts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("listContacts error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// GET ONE
// ============================================================
const getContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id)
      .populate("owner", "fullName email")
      .populate("leadId")
      .lean();

    if (!contact)
      return res.status(404).json({ success: false, message: "Contact not found" });

    if (!canAccessRecord(req.user, contact))
      return res.status(403).json({ success: false, message: "Not authorized" });

    res.json({ success: true, data: contact });
  } catch (error) {
    console.error("getContact error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// CREATE
// ============================================================
const createContact = async (req, res) => {
  try {
    const {
      name,
      company,
      jobTitle,
      email,
      phone,
      whatsappNumber,
      whatsappOptIn,
      tag,
      source,
      companySize,
      notes,
      tags,
      departmentId,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    const contact = await Contact.create({
      name: name.trim(),
      company: company?.trim() || "",
      jobTitle: jobTitle?.trim() || "",
      email: email?.toLowerCase().trim() || "",
      phone: phone?.trim() || "",
      whatsappNumber: whatsappNumber?.trim() || "",
      whatsappOptIn: !!whatsappOptIn,
      owner: req.user._id,
      tag: tag || "cold",
      source: source || "other",
      companySize: Number(companySize) || 0,
      notes: notes?.trim() || "",
      tags: Array.isArray(tags) ? tags : [],
      departmentId: departmentId || req.user.departmentId,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    res.status(201).json({ success: true, data: contact });
  } catch (error) {
    console.error("createContact error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// UPDATE
// ============================================================
const updateContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact)
      return res.status(404).json({ success: false, message: "Contact not found" });

    if (!canAccessRecord(req.user, contact))
      return res.status(403).json({ success: false, message: "Not authorized" });

    const allowed = [
      "name",
      "company",
      "jobTitle",
      "email",
      "phone",
      "whatsappNumber",
      "whatsappOptIn",
      "tag",
      "source",
      "companySize",
      "notes",
      "tags",
      "departmentId",
    ];

    for (const k of allowed) {
      if (req.body[k] !== undefined) contact[k] = req.body[k];
    }
    contact.updatedBy = req.user._id;

    await contact.save();
    res.json({ success: true, data: contact });
  } catch (error) {
    console.error("updateContact error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// DELETE (soft)
// ============================================================
const deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact)
      return res.status(404).json({ success: false, message: "Contact not found" });

    if (!canAccessRecord(req.user, contact))
      return res.status(403).json({ success: false, message: "Not authorized" });

    contact.isActive = false;
    contact.updatedBy = req.user._id;
    await contact.save();

    res.json({ success: true, message: "Contact archived" });
  } catch (error) {
    console.error("deleteContact error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
};