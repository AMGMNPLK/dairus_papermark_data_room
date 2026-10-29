import prisma from "@/lib/prisma";

import { HttpError, owner, safe } from "../../../server/core";

export async function POST(request: Request) {
  return safe(async () => {
    const user = await owner(request, true);
    const { linkId } = await request.json();
    const link = await prisma.link.findFirst({
      where: { id: linkId, teamId: user.teamId },
    });
    if (!link) throw new HttpError(404, "Link not found");
    await prisma.link.update({
      where: { id: link.id },
      data: { isArchived: true, enableNotification: false },
    });
    return Response.json({
      message: "Link revoked. Existing media grants are also blocked.",
    });
  });
}
