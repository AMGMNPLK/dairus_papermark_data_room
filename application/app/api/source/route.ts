import fs from "node:fs/promises";

import { HttpError, owner, safe } from "../../../server/core";

export const dynamic = "force-dynamic";
export async function GET() {
  return safe(async () => {
    // Private preparation: source access is available to the sole app user.
    // Before inviting external viewers, Legal reviews the offer and public access.
    if (process.env.PAPERMARK_SOURCE_PUBLIC !== "true") await owner();
    const location = process.env.PAPERMARK_SOURCE_ARCHIVE;
    if (!location) throw new HttpError(503, "Source package is being prepared");
    return new Response(new Uint8Array(await fs.readFile(location)), {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition":
          'attachment; filename="papermark-community-source.tar.gz"',
        "Cache-Control": "private, no-store",
      },
    });
  });
}
