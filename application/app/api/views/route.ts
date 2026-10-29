import { NextRequest } from "next/server";
import { ratelimit } from "@/lib/redis";

import { POST as nativeView } from "@/app/api/views/route";

import {
  HttpError,
  approvedLink,
  mediaGrant,
  readLimited,
  safe,
  sha256,
} from "../../../server/core";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  return safe(async () => {
    const body = JSON.parse((await readLimited(request, 8192)).toString());
    if (typeof body.password !== "string" || body.password.length > 256)
      throw new HttpError(400, "Viewer password required");
    const { link, version, approval } = await approvedLink(body.linkId);
    const limit = await ratelimit(10, "1 m").limit(
      `viewer-password:${link.id}:${request.headers.get("x-real-ip") || "private"}`,
    );
    if (!limit.success)
      throw new HttpError(429, "Too many access attempts. Try again later.");
    if (
      body.documentId !== link.documentId ||
      body.documentVersionId !== version.id
    )
      throw new HttpError(404, "Document version not found");
    // The public wrapper does not accept client-controlled preview/owner scope.
    const nativeRequest = new NextRequest(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({
        linkId: link.id,
        documentId: link.documentId,
        documentVersionId: version.id,
        documentName: link.document!.name,
        password: body.password,
        email: body.email,
        code: body.code,
        token: body.token,
      }),
    });
    const response = await nativeView(nativeRequest);
    if (response.status >= 500)
      throw new HttpError(503, "Viewer service temporarily unavailable");
    if (response.status !== 200) return response;
    const result = await response.json();
    // Refuse to issue media if approval/primary/visibility changed during native checks.
    const current = await approvedLink(link.id);
    if (
      sha256(JSON.stringify(current.approval)) !==
      sha256(JSON.stringify(approval))
    )
      throw new HttpError(404, "Approval changed");
    const pages = await import("@/lib/prisma").then((m) =>
      m.default.documentPage.findMany({
        where: { versionId: version.id },
        orderBy: { pageNumber: "asc" },
      }),
    );
    const grant = {
      versionId: version.id,
      linkId: link.id,
      viewId: result.viewId,
      approvalHash: sha256(JSON.stringify(approval)),
    };
    return Response.json(
      {
        viewId: result.viewId,
        pages: pages.map((page) => ({
          pageNumber: page.pageNumber,
          file: mediaGrant({ ...grant, page: page.pageNumber }),
        })),
        download: link.allowDownload
          ? mediaGrant({ ...grant, download: true })
          : undefined,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}
