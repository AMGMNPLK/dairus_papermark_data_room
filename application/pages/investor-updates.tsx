import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  ArrowDownUpIcon,
  ArrowRightIcon,
  ExternalLinkIcon,
  FileTextIcon,
  SearchIcon,
} from "lucide-react";

import AppLayout from "@/components/layouts/app";
import motionStyles from "@/styles/investor-updates-motion.module.css";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Category = "overview" | "asks" | "plans" | "progress" | "metrics" | "context" | "other";
type UpdateSection = { id: string; title: string; category: Category; text: string };
type Update = {
  id: string;
  subject: string;
  sentAt: string;
  periodLabel: string;
  periodKey: string;
  sourceUrl: string;
  sourceSha256: string;
  originalText: string;
  sections: UpdateSection[];
  sourceNotes: string[];
};
type Archive = {
  schema: 1;
  audience: { name: string; organization: string; year: number };
  coverage: { matchingSentMessages: number; originalUpdates: number; timezone: string; reviewedAt: string };
  updates: Update[];
};
type SavedNote = { id: string; note: string; revision: string | null };
type Draft = SavedNote & { dirty: boolean };
type Drafts = Record<string, Draft>;

// Next keeps this page module in browser memory across sidebar navigation.
// Never serialize private drafts into localStorage, URLs, server props or source.
let privateDraftMemory: Drafts = {};

const categoryLabel: Record<Category, string> = {
  overview: "Overview",
  asks: "Requests in email",
  plans: "Plans in email",
  progress: "Reported progress",
  metrics: "Historical figures",
  context: "Context",
  other: "Other",
};
const textClass = "whitespace-pre-wrap break-words text-sm leading-7 [overflow-wrap:anywhere]";

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load the private archive.");
  return response.json() as Promise<T>;
}

function formatDate(value: string, timezone: string, includeTime = false) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric", month: "short", year: "numeric", timeZone: timezone,
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  };
  try { return new Intl.DateTimeFormat("en-GB", options).format(date); }
  catch { return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "Europe/Madrid" }).format(date); }
}

function gmailUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "mail.google.com" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function GmailLink({ update }: { update: Update }) {
  const href = gmailUrl(update.sourceUrl);
  if (!href) return <span className="text-xs text-muted-foreground">Gmail source unavailable</span>;
  return (
    <Button asChild variant="outline" className="min-h-11 shrink-0">
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open original email in Gmail: ${update.subject}`}>
        <ExternalLinkIcon aria-hidden="true" /> Original in Gmail
      </a>
    </Button>
  );
}

function PrivateNote({ update, drafts, setDrafts }: {
  update: Update;
  drafts: Drafts;
  setDrafts: Dispatch<SetStateAction<Drafts>>;
}) {
  const endpoint = `/api/investor-updates/notes?id=${encodeURIComponent(update.id)}`;
  const { data, error, isLoading, mutate } = useSWR<SavedNote>(endpoint, fetcher<SavedNote>, { revalidateOnFocus: false });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const draft = drafts[update.id];

  useEffect(() => {
    if (!data) return;
    setDrafts(current => {
      if (current[update.id]?.dirty) return current;
      return { ...current, [update.id]: { ...data, dirty: false } };
    });
  }, [data, update.id, setDrafts]);

  async function save() {
    if (!draft || saving) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/investor-updates/notes", {
        method: "PUT", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: update.id, note: draft.note, revision: draft.revision }),
      });
      if (response.status === 409) {
        setConflict(true);
        setMessage("The saved note changed in another session. Your draft is kept below; review the saved version before trying again.");
        await mutate();
        return;
      }
      if (!response.ok) throw new Error("Your note could not be saved. Your draft is kept here.");
      const saved = await response.json() as SavedNote;
      await mutate(saved, false);
      setDrafts(current => {
        const latest = current[update.id];
        // Keep edits made while the save request was in flight.
        return { ...current, [update.id]: latest?.note === draft.note
          ? { ...saved, dirty: false }
          : { ...saved, note: latest?.note || "", dirty: true } };
      });
      setConflict(false); setMessage("Note saved privately.");
    } catch {
      setMessage("Your note could not be saved. Your draft is kept here.");
    } finally { setSaving(false); }
  }

  return (
    <section className="space-y-3 border-t pt-6" aria-labelledby={`note-title-${update.id}`}>
      <div>
        <h3 id={`note-title-${update.id}`} className="font-semibold">Private note</h3>
        <p className="mt-1 text-sm text-muted-foreground">Your own context, kept separately from the original email.</p>
      </div>
      {isLoading && !draft ? <p role="status" className="text-sm text-muted-foreground">Loading note…</p> : null}
      {error ? (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">The saved note could not be loaded.</p>
          <Button variant="outline" className="min-h-11" onClick={() => void mutate()}>Retry loading note</Button>
        </div>
      ) : null}
      {draft ? (
        <>
          <Label htmlFor={`private-note-${update.id}`}>Note for {update.periodLabel}</Label>
          <Textarea
            id={`private-note-${update.id}`}
            value={draft.note}
            maxLength={10000}
            disabled={saving}
            rows={5}
            className="p-3"
            placeholder="Add a private note about this update…"
            onChange={event => {
              const note = event.currentTarget.value;
              setDrafts(current => ({ ...current, [update.id]: { ...current[update.id], note, dirty: note !== data?.note } }));
              setMessage("");
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{draft.note.length.toLocaleString()} / 10,000 characters{draft.dirty ? " · Unsaved draft" : ""}</p>
            <Button className="min-h-11" disabled={!draft.dirty || !!error || conflict} loading={saving} onClick={() => void save()}>Save note</Button>
          </div>
        </>
      ) : null}
      {message ? <p role={conflict ? "alert" : "status"} className={`text-sm text-muted-foreground ${motionStyles.feedback}`}>{message}</p> : null}
      {conflict && data && !error ? (
        <div className="space-y-3 rounded-md border bg-muted/30 p-4">
          <h4 className="text-sm font-medium">Latest saved note</h4>
          <p className={textClass}>{data.note || "No saved text."}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="min-h-11" onClick={() => {
              setDrafts(current => ({ ...current, [update.id]: { ...data, dirty: false } }));
              setConflict(false); setMessage("Saved version loaded; the previous draft was replaced.");
            }}>Load saved note and replace draft</Button>
            <Button variant="outline" className="min-h-11" onClick={() => {
              setDrafts(current => ({ ...current, [update.id]: { ...current[update.id], revision: data.revision, dirty: true } }));
              setConflict(false); setMessage("Your draft is kept. Save note when you are ready to replace the saved version.");
            }}>Keep draft for the next save</Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function UpdateDetails({ update, timezone, drafts, setDrafts }: {
  update: Update;
  timezone: string;
  drafts: Drafts;
  setDrafts: Dispatch<SetStateAction<Drafts>>;
}) {
  return (
    <Card className={`min-w-0 ${motionStyles.detail}`}>
      <CardHeader className="gap-3 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{update.periodLabel}</Badge>
          <span className="text-xs text-muted-foreground">Sent <time dateTime={update.sentAt}>{formatDate(update.sentAt, timezone, true)}</time> ({timezone})</span>
        </div>
        <h2 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">{update.subject}</h2>
        <div><GmailLink update={update} /></div>
      </CardHeader>
      <CardContent className="space-y-6 p-4 pt-0 sm:p-6 sm:pt-0">
        <Tabs defaultValue="overview">
          <TabsList className="h-auto min-h-12 max-w-full">
            <TabsTrigger value="overview" className="min-h-11">Overview</TabsTrigger>
            <TabsTrigger value="original" className="min-h-11">Read original</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4">
            <p className="mb-3 text-xs text-muted-foreground">Original wording, grouped by section.</p>
            {update.sections.length ? (
              <Accordion type="multiple" defaultValue={[update.sections.find(section => section.category === "overview")?.id || update.sections[0].id]}>
                {update.sections.map(section => (
                  <AccordionItem key={section.id} value={section.id}>
                    <AccordionTrigger className="min-h-11 gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="min-w-0 space-y-1">
                        <span className="block break-words text-xs font-normal text-muted-foreground">{categoryLabel[section.category]}</span>
                        <span className="block break-words text-sm">{section.title}</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent><p className={textClass}>{section.text}</p></AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : <p className="text-sm text-muted-foreground">This email has no section breakdown. Read the original text.</p>}
          </TabsContent>
          <TabsContent value="original" className="mt-4">
            <p className={textClass}>{update.originalText}</p>
          </TabsContent>
        </Tabs>
        <Accordion type="single" collapsible className="border-t">
          <AccordionItem value="source" className="border-b-0">
            <AccordionTrigger className="min-h-11 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Source details</AccordionTrigger>
            <AccordionContent className="space-y-3">
              {update.sourceNotes.map((note, index) => <p key={index} className={textClass}>{note}</p>)}
              <div className="space-y-1 text-xs text-muted-foreground"><p>Original text SHA-256</p><code className="block break-all">{update.sourceSha256}</code></div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <PrivateNote update={update} drafts={drafts} setDrafts={setDrafts} />
      </CardContent>
    </Card>
  );
}

export default function InvestorUpdatesPage() {
  const { data, error, isLoading, mutate } = useSWR<Archive>("/api/investor-updates", fetcher<Archive>, { revalidateOnFocus: false });
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("all");
  const [newestFirst, setNewestFirst] = useState(true);
  const [view, setView] = useState("updates");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Drafts>(() => privateDraftMemory);
  const timezone = data?.coverage.timezone || "Europe/Madrid";
  const hasFilters = query.trim().length > 0 || period !== "all";
  const hasUnsavedNotes = Object.values(drafts).some(draft => draft.dirty);

  useEffect(() => { privateDraftMemory = drafts; }, [drafts]);

  useEffect(() => {
    if (!hasUnsavedNotes) return;
    const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [hasUnsavedNotes]);

  const periods = useMemo(() => {
    const entries = new Set((data?.updates || []).map(update => update.periodKey));
    return [...entries].sort((a, b) => b.localeCompare(a)).map(key => {
      // Group half-month and special updates under their shared reporting month.
      const match = /^(\d{4})-(\d{2})$/.exec(key);
      const label = match
        ? new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)))
        : key;
      return [key, label] as const;
    });
  }, [data]);
  const updates = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return (data?.updates || []).filter(update => {
      if (period !== "all" && update.periodKey !== period) return false;
      return !search || [update.subject, update.periodLabel, update.originalText, ...update.sections.map(section => `${section.title}\n${section.text}`)].some(text => text.toLocaleLowerCase().includes(search));
    }).sort((a, b) => {
      const date = new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime();
      return (newestFirst ? -1 : 1) * (date || a.id.localeCompare(b.id));
    });
  }, [data, query, period, newestFirst]);
  const selected = updates.find(update => update.id === selectedId) || updates[0];
  const asks = updates.flatMap(update => update.sections.filter(section => section.category === "asks").map(section => ({ update, section })));
  const clearFilters = () => { setQuery(""); setPeriod("all"); };

  return (
    <AppLayout>
      <div className={`min-w-0 space-y-6 p-4 sm:m-4 sm:p-4 lg:p-6 ${motionStyles.page}`}>
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Investor updates</h1>
          <p className="text-sm text-muted-foreground">{data ? `${data.audience.name} · ${data.audience.organization} · ${data.audience.year}` : "Your private investor communication archive"}</p>
          {data ? <p className="text-xs text-muted-foreground">{data.coverage.originalUpdates} original updates selected from {data.coverage.matchingSentMessages} matching sent emails.</p> : null}
        </header>
        <p className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">Private historical archive. Figures, plans and requests reflect the original emails; their present status is not inferred.</p>
        {isLoading ? <p role="status" className="py-12 text-center text-sm text-muted-foreground">Loading investor updates…</p> : null}
        {error ? (
          <Card><CardContent className="space-y-3 p-6">
            <p role="alert" className="text-sm text-destructive">The private archive could not be loaded.</p>
            <Button variant="outline" className="min-h-11" onClick={() => void mutate()}>Retry</Button>
          </CardContent></Card>
        ) : null}
        {data ? (
          <>
            <section aria-label="Filter investor updates" className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_240px_auto_auto]">
              <div className="space-y-2">
                <Label htmlFor="investor-update-search">Search emails</Label>
                <div className="relative">
                  <SearchIcon aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input id="investor-update-search" type="search" className="min-h-11 pl-10 pr-3" value={query} onChange={event => setQuery(event.currentTarget.value)} placeholder="Search original wording…" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="investor-update-period">Reporting period</Label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger id="investor-update-period" className="min-h-11" aria-label="Reporting period"><SelectValue /></SelectTrigger>
                  <SelectContent className={motionStyles.portal}><SelectItem value="all" className="min-h-11">All periods</SelectItem>{periods.map(([key, label]) => <SelectItem key={key} value={key} className="min-h-11">{label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button variant="outline" className="min-h-11" aria-label={newestFirst ? "Change sort to oldest first" : "Change sort to newest first"} onClick={() => setNewestFirst(value => !value)}><ArrowDownUpIcon aria-hidden="true" />{newestFirst ? "Newest first" : "Oldest first"}</Button>
              <Button variant="ghost" className="min-h-11" disabled={!hasFilters} onClick={clearFilters}>Clear filters</Button>
            </section>
            <Tabs value={view} onValueChange={setView}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <TabsList className="h-auto min-h-12">
                  <TabsTrigger value="updates" className="min-h-11">Updates ({updates.length})</TabsTrigger>
                  <TabsTrigger value="asks" className="min-h-11">Asks ({asks.length})</TabsTrigger>
                </TabsList>
                <p role="status" className="text-xs text-muted-foreground">{updates.length} of {data.updates.length} updates{hasUnsavedNotes ? " · Private note drafts kept while browsing" : ""}</p>
              </div>
              <TabsContent value="updates" className={`mt-6 ${motionStyles.panel}`}>
                {!updates.length ? (
                  <Card><CardContent className="space-y-3 p-8 text-center">
                    <FileTextIcon aria-hidden="true" className="mx-auto h-8 w-8 text-muted-foreground" />
                    <h2 className="font-semibold">{hasFilters ? "No matching updates" : "No archived updates yet"}</h2>
                    <p className="text-sm text-muted-foreground">{hasFilters ? "Try another phrase or reporting period." : "Historical updates will appear here once the private archive is available."}</p>
                    {hasFilters ? <Button variant="outline" className="min-h-11" onClick={clearFilters}>Show all updates</Button> : null}
                  </CardContent></Card>
                ) : (
                  <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]" aria-label="Investor update timeline">
                    <nav aria-label="Choose an investor update">
                      <ol className="space-y-3 border-l pl-4">
                        {updates.map(update => (
                          <li key={update.id}>
                            <button type="button" onClick={() => setSelectedId(update.id)} aria-pressed={selected?.id === update.id} className={`${motionStyles.timelineChoice} min-h-11 w-full rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected?.id === update.id ? "border-foreground/40 bg-accent" : "bg-card hover:bg-accent/50"}`}>
                              <span className="block text-xs font-medium text-muted-foreground">{update.periodLabel}</span>
                              <span className="mt-2 block break-words text-sm font-semibold">{update.subject}</span>
                              <span className="mt-2 block text-xs text-muted-foreground">Sent <time dateTime={update.sentAt}>{formatDate(update.sentAt, timezone)}</time>{drafts[update.id]?.dirty ? " · Unsaved note" : ""}</span>
                            </button>
                          </li>
                        ))}
                      </ol>
                    </nav>
                    {selected ? <UpdateDetails key={selected.id} update={selected} timezone={timezone} drafts={drafts} setDrafts={setDrafts} /> : null}
                  </section>
                )}
              </TabsContent>
              <TabsContent value="asks" className={`mt-6 space-y-4 ${motionStyles.panel}`}>
                <p className="text-sm text-muted-foreground">Request sections across these historical updates, in the selected sent-date order.</p>
                {!asks.length ? (
                  <Card><CardContent className="space-y-3 p-8 text-center">
                    <h2 className="font-semibold">No request sections in this selection</h2>
                    <p className="text-sm text-muted-foreground">{hasFilters ? "Try another search or reporting period." : "Read the original updates for their full context."}</p>
                    {hasFilters ? <Button variant="outline" className="min-h-11" onClick={clearFilters}>Show all periods</Button> : null}
                  </CardContent></Card>
                ) : asks.map(({ update, section }) => (
                  <Card key={`${update.id}:${section.id}`}>
                    <CardHeader className="space-y-2 p-4 sm:p-6">
                      <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{update.periodLabel}</Badge><span className="text-xs text-muted-foreground">Sent <time dateTime={update.sentAt}>{formatDate(update.sentAt, timezone)}</time></span></div>
                      <h2 className="break-words font-semibold">{section.title}</h2>
                      <p className="break-words text-xs text-muted-foreground">{update.subject}</p>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
                      <p className={textClass}>{section.text}</p>
                      <div className="flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" onClick={() => { setSelectedId(update.id); setView("updates"); }}>Read full update <ArrowRightIcon aria-hidden="true" /></Button><GmailLink update={update} /></div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}
