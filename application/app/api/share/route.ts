import { approvedLink, safe } from "../../../server/core";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return safe(async () => {
    const { link, version } = await approvedLink(
      new URL(request.url).searchParams.get("id") || "",
    );
    return Response.json(
      {
        linkId: link.id,
        documentId: link.documentId,
        versionId: version.id,
        name: link.document!.name,
        requiresPassword: !!link.password,
        allowDownload: link.allowDownload,
        expiresAt: link.expiresAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}
