import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";

import { FormEvent, useEffect, useState } from "react";

type Meta = {
  linkId: string;
  documentId: string;
  versionId: string;
  name: string;
  expiresAt: string;
};
type Viewed = {
  pages: { pageNumber: number; file: string }[];
  download?: string;
};
export default function View() {
  const router = useRouter();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [view, setView] = useState<Viewed | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!router.query.id) return;
    fetch(`/api/share?id=${encodeURIComponent(String(router.query.id))}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message);
        setMeta(body);
      })
      .catch((e) => setError(e.message));
  }, [router.query.id]);
  async function unlock(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!meta) return;
    setBusy(true);
    setError("");
    const password = new FormData(e.currentTarget).get("password");
    try {
      const response = await fetch("/api/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkId: meta.linkId,
          documentId: meta.documentId,
          documentVersionId: meta.versionId,
          password,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);
      setView(body);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Head>
        <title>Shared PDF · Papermark</title>
      </Head>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b p-4">
        <span className="brand">Papermark</span>
        {view?.download && <Link href={view.download}>Download PDF</Link>}
      </header>
      <main className="mx-auto max-w-5xl space-y-5 p-6">
        <h1>{meta?.name || "Shared document"}</h1>
        <p className="text-red-600" role="alert">
          {error}
        </p>
        {meta && !view && (
          <form className="space-y-4 rounded-lg border p-6" onSubmit={unlock}>
            <label>
              Viewer password
              <input
                type="password"
                className="ml-2 rounded-md border p-2 text-foreground"
                name="password"
                required
                autoComplete="current-password"
                maxLength={256}
              />
            </label>
            <button
              className="rounded-md bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
              disabled={busy}
            >
              {busy ? "Checking…" : "View document"}
            </button>
            <p>Access ends {new Date(meta.expiresAt).toLocaleString()}.</p>
          </form>
        )}
        {view?.pages.map((page) => (
          <figure key={page.pageNumber}>
            <img
              className="mx-auto w-full rounded-md border"
              src={page.file}
              alt={`Page ${page.pageNumber}`}
            />
            <figcaption>Page {page.pageNumber}</figcaption>
          </figure>
        ))}
        {view && (
          <p>
            Access to page images expires after two minutes. Reload and enter
            your password again to renew it.
          </p>
        )}
        <footer>
          <Link href="/api/source">Software source and licences</Link>
        </footer>
      </main>
    </>
  );
}
