import { safe, upload } from "../../../server/core";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return safe(async () =>
    Response.json(await upload(request), { status: 202 }),
  );
}
