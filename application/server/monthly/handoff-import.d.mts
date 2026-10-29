export function importMonthlyHandoff(raw: string, expectedPeriod: string): {
  title: string;
  report: string;
  claims: { id: string; text: string; review: ("finance" | "legal")[]; evidence: { source: string; reference: string; date: string; sha256: string }[]; provenance: unknown }[];
  files: { versionId: string; sha256: string }[];
  audience: { roomId: string; investorIds: string[] };
  visibility: { allowDownload: boolean; expiresAt: string; notifications: false };
  gaps: string[];
  provenance: unknown;
};
