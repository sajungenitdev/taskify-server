// src/services/crm/leadScoring.service.js

/**
 * Rule-based lead scoring.
 * Every rule adds to the total AND appends a breakdown line so the UI
 * can render "why this score".
 *
 * The rules mirror the design's Screen 08 example:
 *   Source: demo request               +30
 *   Company size 30–100                +25
 *   Engaged (opened 3 emails)          +23
 *   ─────────────────────────────────────
 *   Total                               78
 */
const RULES = [
  {
    id: "source_demo",
    test: ({ contact }) => contact.source === "demo_request",
    reason: "Source: demo request",
    points: 30,
  },
  {
    id: "source_referral",
    test: ({ contact }) => contact.source === "referral",
    reason: "Source: referral",
    points: 20,
  },
  {
    id: "size_sweet_spot",
    test: ({ contact }) => contact.companySize >= 30 && contact.companySize <= 100,
    reason: "Company size 30–100",
    points: 25,
  },
  {
    id: "size_large",
    test: ({ contact }) => contact.companySize > 100,
    reason: "Company size > 100",
    points: 15,
  },
  {
    id: "engagement_emails",
    test: ({ lead }) => (lead.engagement?.emailsOpened || 0) >= 3,
    reason: "Engaged (opened 3+ emails)",
    points: 23,
  },
  {
    id: "engagement_calls",
    test: ({ lead }) => (lead.engagement?.callsMade || 0) >= 2,
    reason: "Called 2+ times",
    points: 10,
  },
  {
    id: "engagement_meetings",
    test: ({ lead }) => (lead.engagement?.meetingsHeld || 0) >= 1,
    reason: "Held 1+ meeting",
    points: 15,
  },
  {
    id: "tag_hot",
    test: ({ contact }) => contact.tag === "hot",
    reason: "Tagged HOT",
    points: 15,
  },
];

function calculateLeadScore(lead, contact) {
  const breakdown = [];
  let score = 0;

  for (const rule of RULES) {
    try {
      if (rule.test({ lead, contact })) {
        breakdown.push({ reason: rule.reason, points: rule.points });
        score += rule.points;
      }
    } catch (err) {
      // Defensive: a broken rule should not crash scoring
      console.warn(`Lead scoring rule "${rule.id}" failed:`, err.message);
    }
  }

  return {
    score: Math.min(score, 100),
    scoreBreakdown: breakdown,
  };
}

module.exports = { calculateLeadScore, RULES };