import prisma from "@/lib/prisma";

import {
  owner,
  renderState,
  safe,
  readState,
  type Approval,
} from "../../../server/core";

export const dynamic = "force-dynamic";
export async function GET() {
  return safe(async () => {
    const user = await owner();
    const documents = await prisma.document.findMany({
      where: { teamId: user.teamId },
      orderBy: { createdAt: "desc" },
      include: {
        versions: { orderBy: { versionNumber: "desc" } },
        links: {
          where: { deletedAt: null },
          select: { id: true, isArchived: true, expiresAt: true },
        },
      },
    });
    const rows = await Promise.all(
      documents.map(async (document) => ({
        id: document.id,
        name: document.name,
        links: await Promise.all(
          document.links.map(async (link) => {
            const approval = await readState<Approval>(
              `approval-${link.id}.json`,
            );
            const version = document.versions.find(
              (v) => v.id === approval?.versionId,
            );
            return {
              ...link,
              versionId: version?.id,
              versionNumber: version?.versionNumber,
            };
          }),
        ),
        versions: await Promise.all(
          document.versions.map(async (version) => ({
            id: version.id,
            number: version.versionNumber,
            isPrimary: version.isPrimary,
            numPages: version.numPages,
            ready: version.hasPages,
            createdAt: version.createdAt,
            state: await renderState(version.id),
          })),
        ),
      })),
    );
    return Response.json(
      {
        workspace: user.name,
        documents: rows,
        sharingEnabled: process.env.PAPERMARK_PUBLIC_SHARING_ENABLED === "true",
        emailDelivery: false,
        automaticNotifications: false,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}
