import { media, safe } from "../../../server/core";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return safe(() => media(request));
}
