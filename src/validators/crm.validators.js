// src/validators/crm.validators.js
// Lightweight validator helpers (works with express-validator or manual)

const CURRENCIES = ["BDT", "SAR", "USD", "AED", "INR", "EUR", "GBP"];
const STAGES = ["lead_in", "qualified", "proposal", "negotiation", "won", "lost"];
const TAGS = ["hot", "warm", "cold"];
const SOURCES = [
    "demo_request",
    "referral",
    "cold_outreach",
    "website",
    "event",
    "partner",
    "other",
];
const ACTIVITY_TYPES = [
    "call",
    "email",
    "follow_up",
    "meeting",
    "note",
    "stage_change",
    "task_created",
];

function isObjectId(v) {
    return typeof v === "string" && /^[a-f\d]{24}$/i.test(v);
}

function validateContact(body, { partial = false } = {}) {
    const errors = [];
    if (!partial && !body.name) errors.push("name is required");
    if (body.email && !/^\S+@\S+\.\S+$/.test(body.email))
        errors.push("email is invalid");
    if (body.tag && !TAGS.includes(body.tag)) errors.push("tag is invalid");
    if (body.source && !SOURCES.includes(body.source)) errors.push("source is invalid");
    if (body.companySize !== undefined && (isNaN(body.companySize) || body.companySize < 0))
        errors.push("companySize must be >= 0");
    return errors;
}

function validateLead(body, { partial = false } = {}) {
    const errors = [];
    if (!partial) {
        if (!isObjectId(body.contactId)) errors.push("contactId is required");
        if (!body.companyName) errors.push("companyName is required");
        if (typeof body.value !== "number" || body.value <= 0)
            errors.push("value must be > 0");
    }
    if (body.stage && !STAGES.includes(body.stage)) errors.push("stage is invalid");
    if (body.currency && !CURRENCIES.includes(body.currency))
        errors.push("currency is invalid");
    if (
        body.probability !== undefined &&
        (body.probability < 0 || body.probability > 100)
    )
        errors.push("probability must be 0–100");
    return errors;
}

function validateActivity(body) {
    const errors = [];
    if (!body.type || !ACTIVITY_TYPES.includes(body.type))
        errors.push("type is invalid");
    if (!body.summary || !body.summary.trim()) errors.push("summary is required");
    return errors;
}

function validateClient(body, { partial = false } = {}) {
    const errors = [];
    if (!partial && !body.name) errors.push("name is required");
    return errors;
}

function validateRfq(body, { partial = false } = {}) {
    const errors = [];
    if (!partial && !body.title) errors.push("title is required");
    if (body.status && !["open", "submitted", "closed", "cancelled"].includes(body.status))
        errors.push("status is invalid");
    if (body.currency && !CURRENCIES.includes(body.currency))
        errors.push("currency is invalid");
    return errors;
}

module.exports = {
    CURRENCIES,
    STAGES,
    TAGS,
    SOURCES,
    ACTIVITY_TYPES,
    isObjectId,
    validateContact,
    validateLead,
    validateActivity,
    validateClient,
    validateRfq,
};