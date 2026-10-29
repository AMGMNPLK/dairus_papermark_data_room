import { useEffect, useState } from "react";
import useSWR from "swr";
import { PlusIcon, TrashIcon } from "lucide-react";

import AppLayout from "@/components/layouts/app";
import { importMonthlyHandoff } from "../server/monthly/handoff-import.mjs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import motionStyles from "@/styles/investor-updates-motion.module.css";

type Evidence = {
  source: string;
  date: string;
  reference: string;
  sha256: string;
  versionId?: string;
};
type Claim = {
  id: string;
  text: string;
  review: ("finance" | "legal")[];
  evidence: Evidence[];
  provenance?: unknown;
};
type Content = {
  title: string;
  report: string;
  claims: Claim[];
  files: { versionId: string; sha256: string }[];
  audience: { roomId: string; investorIds: string[] };
  visibility: {
    allowDownload: boolean;
    expiresAt: string;
    notifications: false;
  };
  gaps: string[];
  provenance?: unknown;
};
type Candidate = {
  id: string;
  hash: string;
  content: Content;
  createdAt: string;
};
type Monthly = {
  period: string;
  candidate: Candidate | null;
  receipts: unknown[];
  approval: {
    candidateHash: string;
    approvedBy: string;
    approvedAt: string;
  } | null;
};
const empty = (): Content => ({
  title: "",
  report: "",
  claims: [],
  files: [],
  audience: { roomId: "", investorIds: [] },
  visibility: { allowDownload: false, expiresAt: "", notifications: false },
  gaps: [],
});
// In-memory only: retain unsaved work when moving between tabs or periods, without storing private content in a URL or browser storage.
const drafts: Record<string, { content: Content; dirty: boolean }> = {};
function previousMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
async function fetcher(url: string): Promise<Monthly> {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error("The monthly workspace could not be loaded.");
  return response.json();
}
async function post(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof result.message === "string"
        ? result.message
        : "The request could not be completed.";
    const gaps = Array.isArray(result.gaps)
      ? result.gaps.filter(
          (gap: unknown): gap is string => typeof gap === "string",
        )
      : [];
    throw new Error([message, ...gaps].join("\n"));
  }
  return result;
}

export default function MonthlyPage() {
  const [period, setPeriod] = useState(previousMonth);
  const { data, error, isLoading, mutate } = useSWR<Monthly>(
    /^\d{4}-(0[1-9]|1[0-2])$/.test(period)
      ? `/api/monthly?period=${encodeURIComponent(period)}`
      : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const [content, setContent] = useState<Content>(
    () => drafts[period]?.content || empty(),
  );
  const [dirty, setDirty] = useState(drafts[period]?.dirty || false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [handoff, setHandoff] = useState<{
    period: string;
    content: Content;
  } | null>(null);
  const [handoffMessage, setHandoffMessage] = useState("");
  useEffect(() => {
    if (!data || data.period !== period || drafts[period]?.dirty) return;
    const next = data.candidate?.content || empty();
    drafts[period] = { content: next, dirty: false };
    setContent(next);
    setDirty(false);
  }, [data, period]);
  useEffect(() => {
    if (!dirty) return;
    const preventLoss = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [dirty]);
  function edit(next: Content) {
    drafts[period] = { content: next, dirty: true };
    setContent(next);
    setDirty(true);
    setMessage("");
  }
  function changePeriod(next: string) {
    setPeriod(next);
    setContent(drafts[next]?.content || empty());
    setDirty(drafts[next]?.dirty || false);
    setMessage("");
    setHandoff(null);
    setHandoffMessage("");
  }
  async function chooseHandoff(file: File | undefined) {
    setHandoff(null);
    setHandoffMessage("");
    if (!file) return;
    const selectedPeriod = period;
    try {
      if (file.size > 1024 * 1024)
        throw new Error("Handoff exceeds the size limit");
      const draft = importMonthlyHandoff(await file.text(), selectedPeriod);
      setHandoff({ period: selectedPeriod, content: draft });
    } catch (e) {
      setHandoffMessage(
        e instanceof Error ? e.message : "The handoff could not be read.",
      );
    }
  }
  function editClaim(index: number, next: Claim) {
    edit({
      ...content,
      claims: content.claims.map((claim, i) => (i === index ? next : claim)),
    });
  }
  async function save() {
    if (busy) return;
    const savingPeriod = period;
    const snapshot = content;
    setBusy(true);
    setMessage("");
    try {
      await post("/api/monthly", {
        period: savingPeriod,
        content: {
          ...snapshot,
          gaps: snapshot.gaps.filter((gap) => gap.trim()),
          audience: {
            ...snapshot.audience,
            investorIds: snapshot.audience.investorIds
              .map((id) => id.trim())
              .filter(Boolean),
          },
        },
      });
      if (drafts[savingPeriod]?.content === snapshot)
        drafts[savingPeriod] = { content: snapshot, dirty: false };
      if (savingPeriod === period) {
        setDirty(drafts[savingPeriod]?.dirty || false);
        await mutate();
        setMessage("Private candidate saved. It is not published or sent.");
      }
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Unable to save. Your draft is kept.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function approve() {
    if (!data?.candidate || dirty || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await post("/api/monthly/approve", {
        candidateId: data.candidate.id,
        candidateHash: data.candidate.hash,
        confirmReviewed: true,
      });
      await mutate();
      setMessage(
        "Founder approval recorded for this exact candidate. It is not published.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Approval could not be recorded.",
      );
    } finally {
      setBusy(false);
    }
  }
  const candidate = data?.candidate;
  const approved =
    !!candidate && data?.approval?.candidateHash === candidate.hash;
  return (
    <AppLayout>
      <main
        className={`min-w-0 space-y-6 p-4 sm:m-4 sm:p-4 lg:p-6 ${motionStyles.page}`}
      >
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Monthly investor relations
            </h1>
            <p className="text-sm text-muted-foreground">
              Prepare a private company update with traceable evidence and
              review.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="month">Reporting month</Label>
            <Input
              id="month"
              type="month"
              className="min-h-11"
              disabled={busy}
              value={period}
              onChange={(e) => changePeriod(e.currentTarget.value)}
            />
          </div>
        </header>
        <p className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Private preparation only. Saving or approving does not publish, invite
          viewers, send messages, or activate a schedule. The historical
          correspondence archive remains separate.
        </p>
        {isLoading && <p role="status">Loading monthly workspace…</p>}
        {error && (
          <Card>
            <CardContent className="space-y-3 p-6">
              <p role="alert" className="text-destructive">
                The monthly workspace could not be loaded. Your draft is kept.
              </p>
              <Button variant="outline" onClick={() => void mutate()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        )}
        {!isLoading && !error && data && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {candidate ? `Candidate ${candidate.id}` : "No saved candidate"}
              </Badge>
              <Badge variant="secondary">
                {approved
                  ? "Historical founder approval recorded"
                  : "Founder approval pending"}
              </Badge>
              {dirty && (
                <span className="text-sm text-muted-foreground">
                  Unsaved changes
                </span>
              )}
            </div>
            <Tabs defaultValue="coverage">
              <TabsList className="h-auto max-w-full flex-wrap justify-start">
                <TabsTrigger className="min-h-11" value="coverage">
                  Coverage
                </TabsTrigger>
                <TabsTrigger className="min-h-11" value="draft">
                  Draft
                </TabsTrigger>
                <TabsTrigger className="min-h-11" value="evidence">
                  Evidence
                </TabsTrigger>
                <TabsTrigger className="min-h-11" value="audience">
                  Audience &amp; files
                </TabsTrigger>
                <TabsTrigger className="min-h-11" value="review">
                  Review
                </TabsTrigger>
                <TabsTrigger className="min-h-11" value="approval">
                  Approval
                </TabsTrigger>
                <TabsTrigger className="min-h-11" value="preview">
                  Preview
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="coverage"
                className={`mt-4 ${motionStyles.panel}`}
              >
                <Card>
                  <CardHeader>
                    <h2 className="font-semibold">Collection coverage</h2>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <p>
                      Source coverage has not been verified in this workspace.
                      ClickUp, ERPNext and Swarm collection receipts must be
                      inspected before claims can be treated as complete. An
                      empty finance query is missing coverage, not zero revenue.
                    </p>
                    <div className="space-y-3 rounded-md border p-4">
                      <h3 className="font-medium">
                        Import a private preparation handoff
                      </h3>
                      <p>
                        Choose a monthly-preparation/v1 JSON file for this
                        month. It is unsigned input; source coverage and
                        evidence still require verification. Loading it replaces
                        the current draft only after you choose the button
                        below. Nothing is saved or published automatically.
                      </p>
                      <Label htmlFor="handoff">Preparation file</Label>
                      <Input
                        id="handoff"
                        type="file"
                        accept="application/json,.json"
                        onChange={(e) => {
                          void chooseHandoff(e.currentTarget.files?.[0]);
                          e.currentTarget.value = "";
                        }}
                      />
                      {handoffMessage && (
                        <p role="alert" className="text-destructive">
                          {handoffMessage}
                        </p>
                      )}
                      {handoff && handoff.period === period && (
                        <div className="space-y-2">
                          <p>
                            {handoff.content.claims.length} claims and{" "}
                            {handoff.content.gaps.length} gaps found. Audience
                            and expiry must be supplied separately.
                          </p>
                          <Button
                            variant="outline"
                            onClick={() => {
                              edit(handoff.content);
                              setHandoff(null);
                              setHandoffMessage(
                                "Handoff loaded as an unsaved draft. Review its gaps, audience and expiry before saving.",
                              );
                            }}
                          >
                            Load handoff and replace current draft
                          </Button>
                        </div>
                      )}
                    </div>
                    {content.provenance != null && (
                      <details>
                        <summary className="cursor-pointer font-medium">
                          Imported coverage and provenance
                        </summary>
                        <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded-md border p-3 text-xs">
                          {JSON.stringify(content.provenance, null, 2)}
                        </pre>
                      </details>
                    )}
                    <Label htmlFor="gaps">Known gaps, one per line</Label>
                    <Textarea
                      id="gaps"
                      rows={5}
                      value={content.gaps.join("\n")}
                      onChange={(e) =>
                        edit({
                          ...content,
                          gaps: e.currentTarget.value.split("\n"),
                        })
                      }
                      placeholder="Record failed reads, missing evidence or unresolved coverage…"
                    />
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent
                value="draft"
                className={`mt-4 space-y-4 ${motionStyles.panel}`}
              >
                <Card>
                  <CardHeader>
                    <h2 className="font-semibold">Private draft</h2>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={content.title}
                        onChange={(e) =>
                          edit({ ...content, title: e.currentTarget.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="report">Report</Label>
                      <Textarea
                        id="report"
                        rows={12}
                        value={content.report}
                        onChange={(e) =>
                          edit({ ...content, report: e.currentTarget.value })
                        }
                        placeholder="Progress, metrics, risks, next milestones, prior commitments and specific asks…"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Approval requires the report to consist of the exact claim
                      wording, in order, separated by blank lines. Add a dated
                      source and evidence for each claim. Updated work is
                      context, not proof of completion.
                    </p>
                    <Button
                      variant="outline"
                      disabled={!content.claims.length}
                      onClick={() =>
                        edit({
                          ...content,
                          report: content.claims
                            .map((claim) => claim.text)
                            .join("\n\n"),
                        })
                      }
                    >
                      Use exact claim wording in report
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent
                value="evidence"
                className={`mt-4 space-y-4 ${motionStyles.panel}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-semibold">Claims and evidence</h2>
                  <Button
                    variant="outline"
                    onClick={() =>
                      edit({
                        ...content,
                        claims: [
                          ...content.claims,
                          {
                            id: `claim-${crypto.randomUUID()}`,
                            text: "",
                            review: [],
                            evidence: [],
                          },
                        ],
                      })
                    }
                  >
                    <PlusIcon aria-hidden="true" /> Add claim
                  </Button>
                </div>
                {content.claims.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No claims have been recorded. Claims without evidence cannot
                    be approved.
                  </p>
                )}
                {content.claims.map((claim, i) => (
                  <Card key={claim.id}>
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-medium">Claim {i + 1}</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove claim ${i + 1}`}
                          onClick={() =>
                            edit({
                              ...content,
                              claims: content.claims.filter((_, n) => n !== i),
                            })
                          }
                        >
                          <TrashIcon aria-hidden="true" /> Remove
                        </Button>
                      </div>
                      <Label htmlFor={`claim-${i}`}>Exact wording</Label>
                      <Textarea
                        id={`claim-${i}`}
                        value={claim.text}
                        onChange={(e) =>
                          editClaim(i, {
                            ...claim,
                            text: e.currentTarget.value,
                          })
                        }
                      />
                      {claim.provenance != null && (
                        <details>
                          <summary className="cursor-pointer text-sm font-medium">
                            Source lineage and imported gaps
                          </summary>
                          <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded-md border p-3 text-xs">
                            {JSON.stringify(claim.provenance, null, 2)}
                          </pre>
                        </details>
                      )}
                      <fieldset className="space-y-2">
                        <legend className="text-sm font-medium">
                          Specialist review needed
                        </legend>
                        <div className="flex gap-4">
                          {(["finance", "legal"] as const).map((role) => (
                            <label
                              key={role}
                              className="flex items-center gap-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={claim.review.includes(role)}
                                onChange={(e) =>
                                  editClaim(i, {
                                    ...claim,
                                    review: e.currentTarget.checked
                                      ? [...claim.review, role]
                                      : claim.review.filter((v) => v !== role),
                                  })
                                }
                              />
                              {role === "finance" ? "Finance" : "Legal"}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      {claim.evidence.map((item, j) => (
                        <div
                          key={j}
                          className="grid gap-3 rounded-md border p-3 sm:grid-cols-3"
                        >
                          {(
                            ["source", "date", "reference", "sha256"] as const
                          ).map((field) => (
                            <div className="space-y-2" key={field}>
                              <Label htmlFor={`evidence-${i}-${j}-${field}`}>
                                {field === "source"
                                  ? "Source"
                                  : field === "date"
                                    ? "Source date (ISO 8601 with timezone)"
                                    : field === "reference"
                                      ? "Exact reference"
                                      : "SHA-256"}
                              </Label>
                              <Input
                                id={`evidence-${i}-${j}-${field}`}
                                value={item[field]}
                                onChange={(e) =>
                                  editClaim(i, {
                                    ...claim,
                                    evidence: claim.evidence.map((v, n) =>
                                      n === j
                                        ? {
                                            ...v,
                                            [field]: e.currentTarget.value,
                                          }
                                        : v,
                                    ),
                                  })
                                }
                              />
                            </div>
                          ))}
                          <div className="space-y-2">
                            <Label htmlFor={`evidence-${i}-${j}-version`}>
                              Private PDF version ID (optional for draft)
                            </Label>
                            <Input
                              id={`evidence-${i}-${j}-version`}
                              value={item.versionId || ""}
                              onChange={(e) => {
                                const value = e.currentTarget.value;
                                editClaim(i, {
                                  ...claim,
                                  evidence: claim.evidence.map((v, n) => {
                                    if (n !== j) return v;
                                    const { versionId: _old, ...rest } = v;
                                    return value
                                      ? { ...rest, versionId: value }
                                      : rest;
                                  }),
                                });
                              }}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              editClaim(i, {
                                ...claim,
                                evidence: claim.evidence.filter(
                                  (_, n) => n !== j,
                                ),
                              })
                            }
                          >
                            Remove evidence
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          editClaim(i, {
                            ...claim,
                            evidence: [
                              ...claim.evidence,
                              {
                                source: "",
                                date: "",
                                reference: "",
                                sha256: "",
                              },
                            ],
                          })
                        }
                      >
                        Add evidence
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
              <TabsContent
                value="audience"
                className={`mt-4 space-y-4 ${motionStyles.panel}`}
              >
                <Card>
                  <CardHeader>
                    <h2 className="font-semibold">Audience and visibility</h2>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      These settings are part of the exact candidate. They do
                      not provision access or invite anyone.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="room">Room identifier</Label>
                      <Input
                        id="room"
                        value={content.audience.roomId}
                        onChange={(e) =>
                          edit({
                            ...content,
                            audience: {
                              ...content.audience,
                              roomId: e.currentTarget.value,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="investors">
                        Investor identifiers, one per line
                      </Label>
                      <Textarea
                        id="investors"
                        rows={3}
                        value={content.audience.investorIds.join("\n")}
                        onChange={(e) =>
                          edit({
                            ...content,
                            audience: {
                              ...content.audience,
                              investorIds: e.currentTarget.value.split("\n"),
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expires">
                        Access expiry (ISO 8601 with timezone, for example
                        2030-05-31T23:59:00Z)
                      </Label>
                      <Input
                        id="expires"
                        value={content.visibility.expiresAt}
                        onChange={(e) =>
                          edit({
                            ...content,
                            visibility: {
                              ...content.visibility,
                              expiresAt: e.currentTarget.value,
                            },
                          })
                        }
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={content.visibility.allowDownload}
                        onChange={(e) =>
                          edit({
                            ...content,
                            visibility: {
                              ...content.visibility,
                              allowDownload: e.currentTarget.checked,
                            },
                          })
                        }
                      />
                      Allow downloads if separately published
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Notifications are disabled.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="font-semibold">Exact file versions</h2>
                      <Button
                        variant="outline"
                        onClick={() =>
                          edit({
                            ...content,
                            files: [
                              ...content.files,
                              { versionId: "", sha256: "" },
                            ],
                          })
                        }
                      >
                        Add file version
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {content.files.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No files attached to this candidate.
                      </p>
                    )}
                    {content.files.map((file, i) => (
                      <div
                        className="grid gap-3 rounded-md border p-3 sm:grid-cols-2"
                        key={i}
                      >
                        <div className="space-y-2">
                          <Label htmlFor={`file-version-${i}`}>
                            Version identifier
                          </Label>
                          <Input
                            id={`file-version-${i}`}
                            value={file.versionId}
                            onChange={(e) =>
                              edit({
                                ...content,
                                files: content.files.map((v, n) =>
                                  n === i
                                    ? { ...v, versionId: e.currentTarget.value }
                                    : v,
                                ),
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`file-hash-${i}`}>SHA-256</Label>
                          <Input
                            id={`file-hash-${i}`}
                            value={file.sha256}
                            onChange={(e) =>
                              edit({
                                ...content,
                                files: content.files.map((v, n) =>
                                  n === i
                                    ? { ...v, sha256: e.currentTarget.value }
                                    : v,
                                ),
                              })
                            }
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            edit({
                              ...content,
                              files: content.files.filter((_, n) => n !== i),
                            })
                          }
                        >
                          Remove file
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent
                value="review"
                className={`mt-4 ${motionStyles.panel}`}
              >
                <Card>
                  <CardHeader>
                    <h2 className="font-semibold">Finance and Legal review</h2>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p>
                      Review is claim-specific and requires an authenticated
                      specialist. A draft, role label or successful request is
                      not validation.
                    </p>
                    <p>
                      {data.receipts.length} authenticated review receipt
                      {data.receipts.length === 1 ? "" : "s"} for the saved
                      candidate.
                    </p>
                    {data.receipts.map((receipt, index) => (
                      <pre
                        key={index}
                        className="overflow-auto whitespace-pre-wrap break-words rounded-md border p-3 text-xs"
                      >
                        {JSON.stringify(receipt, null, 2)}
                      </pre>
                    ))}
                    {content.claims
                      .filter((c) => c.review.length)
                      .map((c) => (
                        <div key={c.id} className="rounded-md border p-3">
                          <p>{c.text || "Untitled claim"}</p>
                          <p className="mt-1 text-muted-foreground">
                            Requested: {c.review.join(", ")}
                          </p>
                        </div>
                      ))}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent
                value="approval"
                className={`mt-4 ${motionStyles.panel}`}
              >
                <Card>
                  <CardHeader>
                    <h2 className="font-semibold">
                      Exact-version founder approval
                    </h2>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <p>
                      Review the saved content, evidence, file versions,
                      audience and visibility before approving. Any change
                      creates a new candidate and requires review again.
                    </p>
                    <p>
                      Approval is unavailable until source evidence bytes can be
                      verified and specialist review scope can be adjudicated. A
                      historical approval record does not grant access or
                      authorize publication.
                    </p>
                    {candidate ? (
                      <>
                        <p>Candidate hash</p>
                        <code className="block break-all">
                          {candidate.hash}
                        </code>
                        <p>
                          {approved
                            ? `Historical approval recorded ${data.approval?.approvedAt}`
                            : "Approval pending"}
                        </p>
                        <Button disabled onClick={() => void approve()}>
                          I reviewed and approve this exact candidate
                        </Button>
                      </>
                    ) : (
                      <p>Save a candidate before seeking approval.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent
                value="preview"
                className={`mt-4 ${motionStyles.panel}`}
              >
                <Card>
                  <CardHeader>
                    <h2 className="text-xl font-semibold">
                      {content.title || "Untitled update"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Private preview · {period}
                      {dirty ? " · includes unsaved changes" : ""}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="whitespace-pre-wrap break-words text-sm leading-7">
                      {content.report || "No report entered."}
                    </p>
                    {content.claims.map((c) => (
                      <div key={c.id} className="border-t pt-3">
                        <p className="whitespace-pre-wrap text-sm">{c.text}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {c.evidence.length} evidence reference
                          {c.evidence.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={busy || !dirty} onClick={() => void save()}>
                Save private candidate
              </Button>
              {message && (
                <p
                  role="status"
                  className="whitespace-pre-wrap text-sm text-muted-foreground"
                >
                  {message}
                </p>
              )}
            </div>
          </>
        )}
      </main>
    </AppLayout>
  );
}
