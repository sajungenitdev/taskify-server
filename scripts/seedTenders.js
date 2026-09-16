// scripts/seedTenders.js
const mongoose = require("mongoose");
require("dotenv").config();

const Tender = require("../src/models/Tender.model");
const TenderDocumentTask = require("../src/models/TenderDocumentTask.model");
const TenderSecurity = require("../src/models/TenderSecurity.model");
const CompanyDocument = require("../src/models/CompanyDocument.model");
const { User } = require("../src/models/User.model");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const admin = await User.findOne({ role: "super_admin" }).lean();
  if (!admin) {
    console.error("No super_admin user found — create one first.");
    process.exit(1);
  }

  await Promise.all([
    Tender.deleteMany({}),
    TenderDocumentTask.deleteMany({}),
    TenderSecurity.deleteMany({}),
    CompanyDocument.deleteMany({}),
  ]);

  /* ---------- TENDERS ---------- */
  const now = Date.now();
  const day = 86400000;

  const tenders = await Tender.insertMany([
    {
      tenderer: "Bangladesh Meteorological Dept.",
      title: "BDWS Automation Software",
      stage: "active",
      tenderType: "eGP",
      description: "BDWS automation software update covering 12 met stations.",
      tenderLink: "eGP.gov.bd/metdept/2608-bdws",
      recordedBy: "Akramul",
      responsiblePerson: "Nahid Hasan",
      lastDateOfPurchase: new Date(now + 2 * day),
      lastDateOfSubmission: new Date(now + 6 * day),
      tentativeBudget: 1318646,
      bidValue: 1318646,
      mode: "eGP — Online",
      readiness: 50,
      docStatus: "Docs in progress",
      note: "BDWS automation software update covering 12 met stations. Client technical team has confirmed compatibility requirements informally.",
      eligibility: "Requires: 3 years automation software experience, 2 reference installations, valid trade license. No partner certificate required.",
      attachments: [
        { name: "Tender_Notice_MetDept_BDWS.pdf" },
        { name: "Technical_Specification.pdf" },
        { name: "Draft_BoQ_MetDept.xlsx" },
      ],
      advertisementFile: "Tender_Notice_MetDept_BDWS.pdf",
      advertisementUploadedBy: "Akramul · 5 days ago",
      owner: admin._id,
      createdBy: admin._id,
    },
    {
      tenderer: "PGCB",
      title: "Antivirus / EDR Deployment",
      stage: "active",
      tenderType: "eGP",
      description: "Endpoint protection deployment across 8 substations.",
      lastDateOfSubmission: new Date(now + 6 * day),
      tentativeBudget: 1318085,
      bidValue: 1318085,
      mode: "eGP — Online",
      readiness: 17,
      docStatus: "Docs pending",
      eligibility: "3+ years endpoint security deployment experience.",
      owner: admin._id,
      createdBy: admin._id,
    },
    {
      tenderer: "Pubali Bank Ltd.",
      title: "Kiosk — Self-Service Desk",
      stage: "submitted",
      tenderType: "RFQ",
      description: "Self-service kiosk supply and installation.",
      lastDateOfSubmission: new Date(now - 10 * day),
      submittedAt: new Date(now - 10 * day),
      submitted: true,
      bidValue: 680000,
      mode: "Hardcopy Ref.",
      readiness: 100,
      docStatus: "Complete",
      attachments: [
        { name: "Commercial_Offer.pdf" },
        { name: "Technical_Proposal.pdf" },
        { name: "Tender_Security_PO.pdf" },
        { name: "Company_Profile.pdf" },
      ],
      otherParticipants: [
        { bidder: "TechVantage Ltd.", value: 720000 },
        { bidder: "Meghna Systems", value: 695000 },
        { bidder: "NGEN IT Limited (us)", value: 680000, isUs: true },
      ],
      owner: admin._id,
      createdBy: admin._id,
    },
    {
      tenderer: "Janata Bank PLC",
      title: "RHEL Server Standard Subscription",
      stage: "active",
      tenderType: "eGP",
      description: "RHEL enterprise subscription renewal — 40 sockets.",
      lastDateOfSubmission: new Date(now + 9 * day),
      tentativeBudget: 1319279,
      bidValue: 1319279,
      mode: "eGP — Online",
      readiness: 75,
      docStatus: "Banking docs pending",
      owner: admin._id,
      createdBy: admin._id,
    },
    {
      tenderer: "ICB Islamic Bank",
      title: "Firewall Replacement",
      stage: "lost",
      tenderType: "eGP",
      bidValue: 645000,
      lossReason:
        "Missing OEM Authorization Letter — technically non-responsive, bid not evaluated",
      lowestCompliantBidder: "TechVantage Ltd.",
      lowestCompliantValue: 620000,
      lostAt: new Date(now - 90 * day),
      owner: admin._id,
      createdBy: admin._id,
    },
  ]);

  /* ---------- DOC TASKS for the first 2 tenders ---------- */
  await TenderDocumentTask.insertMany([
    {
      tenderId: tenders[0]._id,
      title: "Commercial Documents",
      owner: "Sales — Akramul",
      fileName: "Commercial_Offer_MetDept.pdf",
      status: "Done",
      order: 0,
      createdBy: admin._id,
    },
    {
      tenderId: tenders[0]._id,
      title: "Price Documents (per product)",
      owner: "Product Manager — Nahid",
      fileName: "Price_Sheet_MetDept_DRAFT.xlsx",
      status: "In Progress",
      order: 1,
      createdBy: admin._id,
    },
    {
      tenderId: tenders[0]._id,
      title: "Banking Documents",
      owner: "Finance",
      fileName: "No file uploaded yet",
      status: "Pending",
      order: 2,
      createdBy: admin._id,
    },
    {
      tenderId: tenders[1]._id,
      title: "Commercial Documents",
      owner: "Sales — Akramul",
      fileName: "No file uploaded yet",
      status: "Pending",
      order: 0,
      createdBy: admin._id,
    },
  ]);

  /* ---------- SECURITY ---------- */
  await TenderSecurity.insertMany([
    {
      entity: "NGL-26",
      clientDescription: "Bangladesh Bank — EViews Software",
      type: "Tender Security",
      amount: 50000,
      dueDate: new Date(now + 30 * day),
      docsStatus: "Attached",
      createdBy: admin._id,
    },
    {
      entity: "NGL-26",
      clientDescription: "Bangladesh Bank — EViews Software",
      type: "Performance Security",
      amount: 213000,
      dueDate: new Date(now + 30 * day),
      docsStatus: "Attached",
      createdBy: admin._id,
    },
    {
      entity: "NGL-26",
      clientDescription: "University of Asia Pacific — Pharmaceuticals",
      type: "Tender Security",
      amount: 4500,
      dueDate: new Date(now + 45 * day),
      docsStatus: "Missing",
      createdBy: admin._id,
    },
    {
      entity: "NGL-26",
      clientDescription: "University of Asia Pacific — Civil Engineering",
      type: "Tender Security",
      amount: 3695,
      dueDate: new Date(now + 45 * day),
      docsStatus: "Missing",
      createdBy: admin._id,
    },
    {
      entity: "NG-26",
      clientDescription: "Sonali Bank PLC — Radmin Software",
      type: "Tender Security",
      amount: 35000,
      dueDate: new Date(now + 15 * day),
      docsStatus: "Attached",
      createdBy: admin._id,
    },
    {
      entity: "NG-26",
      clientDescription: "EGCB — Acronis Backup",
      type: "Tender Security",
      amount: 110000,
      dueDate: new Date(now + 15 * day),
      docsStatus: "Attached",
      createdBy: admin._id,
    },
    {
      entity: "NG-26",
      clientDescription: "EGCB — Acronis Backup",
      type: "Performance Security",
      amount: 449752.5,
      dueDate: new Date(now + 15 * day),
      docsStatus: "Missing",
      createdBy: admin._id,
    },
    {
      entity: "JT",
      clientDescription: "Pending deposit",
      type: "Bank Guarantee",
      amount: 10500,
      dueDate: new Date(now + 30 * day),
      docsStatus: "Missing",
      createdBy: admin._id,
    },
  ]);

  /* ---------- COMPANY DOCS ---------- */
  await CompanyDocument.insertMany([
    {
      category: "legal",
      title: "Trade License",
      reference: "TRAD/DNCC/2026/04471",
      validity: "Valid until 30 Jun 2027",
      status: "Valid",
      createdBy: admin._id,
    },
    {
      category: "legal",
      title: "TIN Certificate",
      reference: "178439827-8482",
      validity: "No expiry",
      status: "Valid",
      createdBy: admin._id,
    },
    {
      category: "legal",
      title: "VAT Registration (BIN)",
      reference: "000493827-8482",
      validity: "No expiry",
      status: "Valid",
      createdBy: admin._id,
    },
    {
      category: "legal",
      title: "Certificate of Incorporation",
      reference: "C-142857",
      validity: "No expiry",
      status: "Valid",
      createdBy: admin._id,
    },
    {
      category: "legal",
      title: "Bank Solvency Certificate",
      reference: "Premier Bank, Shyamoli Branch",
      validity: "Issued 15 Jan 2026",
      status: "Expiring Soon",
      action: "Replace",
      createdBy: admin._id,
    },
    {
      category: "legal",
      title: "BASIS Membership",
      reference: "BASIS-2019-0847",
      validity: "Renewed annually",
      status: "Valid",
      createdBy: admin._id,
    },
    {
      category: "experience",
      title: "EGCB",
      subtitle: "Acronis Backup Solutions, ongoing since 2023",
      chips: ["Power & Energy", "3+ Yrs", "৳5L+"],
      status: "Valid",
      createdBy: admin._id,
    },
    {
      category: "experience",
      title: "Bangladesh Bank",
      subtitle: "EViews software supply & support since 2021",
      chips: ["Financial", "5+ Yrs", "৳25L+"],
      status: "Valid",
      createdBy: admin._id,
    },
    {
      category: "experience",
      title: "Sonali Bank PLC",
      subtitle: "Radmin Software procurement, completed 2026",
      chips: ["Financial", "1+ Yr", "৳3L+"],
      status: "Valid",
      createdBy: admin._id,
    },
    {
      category: "experience",
      title: "Pubali Bank Ltd.",
      subtitle: "Self-service Kiosk supply and installation",
      chips: ["Financial", "1+ Yr", "৳5L+"],
      status: "Valid",
      createdBy: admin._id,
    },
    {
      category: "experience",
      title: "PGCB",
      subtitle: "Antivirus/EDR deployment across grid control network",
      chips: ["Government", "1+ Yr", "৳10L+"],
      status: "Valid",
      createdBy: admin._id,
    },
    {
      category: "experience",
      title: "Bangladesh Meteorological Dept.",
      subtitle: "BDWS Automation Software update and maintenance",
      chips: ["Government", "< 1 Yr", "৳10L+"],
      status: "Valid",
      createdBy: admin._id,
    },
  ]);

  console.log("✅ Tender module seeded");
  process.exit(0);
})().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});