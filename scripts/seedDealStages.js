// scripts/seedDealStages.js
const mongoose = require("mongoose");
require("dotenv").config();
const DealStageConfig = require("../src/models/DealStageConfig.model");

const STAGES = [
  { stageKey: "lead_in", label: "Lead In", defaultProbability: 10, order: 1 },
  { stageKey: "qualified", label: "Qualified", defaultProbability: 30, order: 2 },
  { stageKey: "proposal", label: "Proposal", defaultProbability: 50, order: 3 },
  { stageKey: "negotiation", label: "Negotiation", defaultProbability: 70, order: 4 },
  { stageKey: "won", label: "Won", defaultProbability: 100, order: 5, isTerminal: true, color: "#10b981" },
  { stageKey: "lost", label: "Lost", defaultProbability: 0, order: 6, isTerminal: true, color: "#ef4444" },
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const s of STAGES) {
    await DealStageConfig.updateOne(
      { stageKey: s.stageKey },
      { $set: s },
      { upsert: true }
    );
  }
  console.log("✅ Deal stages seeded");
  process.exit(0);
})();