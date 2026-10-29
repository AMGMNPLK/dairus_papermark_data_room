import {
  HttpError,
  mediaGrant,
  ownedVersion,
  owner,
  safe,
} from "../../../server/core";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return safe(async () => {
    const user = await owner();
    const version = await ownedVersion(
      new URL(request.url).searchParams.get("versionId") || "",
      user.teamId,
    );
    if (!version.hasPages)
      throw new HttpError(409, "PDF processing is not complete");
    return Response.json(
      {
        name: version.document.name,
        versionId: version.id,
        pages: version.pages.map((page) => ({
          pageNumber: page.pageNumber,
          file: mediaGrant({
            versionId: version.id,
            page: page.pageNumber,
            ownerId: user.id,
          }),
        })),
        download: mediaGrant({
          versionId: version.id,
          download: true,
          ownerId: user.id,
        }),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}
