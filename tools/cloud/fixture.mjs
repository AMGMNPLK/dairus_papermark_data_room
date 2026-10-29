import { createHash } from "node:crypto";

// Entirely invented history. The legacy archive schema accepts 2023 only.
// It must never be presented as actual correspondence or September 2026 results.
const originalText = "SYNTHETIC HISTORICAL DEMO — no message was sent.\nA fictional team reviewed a sample document. No real company, customer, revenue or delivery claim is represented.";
export const historicalFixture = {
  schema: 1,
  audience: { name: "Synthetic Demo Viewer", organization: "Example Organization", year: 2023 },
  coverage: { matchingSentMessages: 0, originalUpdates: 1, timezone: "Europe/Madrid", reviewedAt: "2023-02-01T12:00:00+00:00" },
  updates: [{ id: "0000000000000001", subject: "SYNTHETIC historical demo — January 2023", sentAt: "2023-02-01T12:00:00+00:00", periodLabel: "Fictional January 2023 demonstration", periodKey: "2023-01", sourceUrl: "https://mail.google.com/mail/u/0/#all/synthetic-demo-not-a-message", sourceSha256: createHash("sha256").update(originalText).digest("hex"), originalText, sections: [{ id: "section-1", title: "Synthetic example only", category: "context", text: originalText }], sourceNotes: ["Generated fictional fixture. No Gmail read, message, attachment or investor data.", "Legacy historical archive demonstration; not the September 2026 monthly pilot."] }],
};
