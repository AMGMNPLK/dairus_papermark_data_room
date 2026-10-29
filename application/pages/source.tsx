import Link from "next/link";

export default function Source() {
  return (
    <main className="login">
      <p className="eyebrow">PAPERMARK COMMUNITY</p>
      <h1>Software source</h1>
      <p>
        This installation uses the AGPLv3 Papermark core and MuPDF, with a local
        integration maintained on ironclad. Commercial Papermark server features
        are excluded.
      </p>
      <p>
        <Link href="/api/source">
          Download corresponding source and licence notices
        </Link>
      </p>
      <p>
        The package contains software and build instructions. It contains no
        company documents, credentials or runtime database.
      </p>
      <p>
        <Link href="/">Return to workspace</Link>
      </p>
    </main>
  );
}
