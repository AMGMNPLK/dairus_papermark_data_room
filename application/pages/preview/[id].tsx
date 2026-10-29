import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";

import { useEffect, useState } from "react";

type Preview = {
  name: string;
  pages: { pageNumber: number; file: string }[];
  download: string;
};
export default function Preview() {
  const router = useRouter();
  const [data, setData] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!router.query.id) return;
    fetch(
      `/api/preview?versionId=${encodeURIComponent(String(router.query.id))}`,
    )
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message);
        setData(body);
      })
      .catch((e) => setError(e.message));
  }, [router.query.id]);
  return (
    <>
      <Head>
        <title>Private PDF preview · Papermark</title>
      </Head>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b p-4">
        <Link href="/">← Private workspace</Link>
        <strong>Owner preview</strong>
        {data && <Link href={data.download}>Download exact PDF</Link>}
      </header>
      <main className="mx-auto max-w-5xl space-y-5 p-6">
        <h1>{data?.name || "Private preview"}</h1>
        <p role="alert">{error}</p>
        {data?.pages.map((page) => (
          <figure key={page.pageNumber}>
            <img
              className="mx-auto w-full rounded-md border"
              src={page.file}
              alt={`Page ${page.pageNumber}`}
            />
            <figcaption>Page {page.pageNumber}</figcaption>
          </figure>
        ))}
        <p>Preview access expires after two minutes. Reload to renew it.</p>
      </main>
    </>
  );
}
