import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getTeamS3ClientAndConfig } from "@/lib/files/aws-client";
import { HttpError, ownedVersion, renderState, sha256 } from "../core";

// This verifies bytes of an uploaded private PDF; it does not attest that the
// stated external source, date or business claim is authentic.
export async function readVerifiedEvidence(teamId: string, evidence: any) {
  if (!evidence || typeof evidence.versionId !== "string" || typeof evidence.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(evidence.sha256)) throw new HttpError(409, "Evidence requires an exact uploaded file version and digest");
  const version = await ownedVersion(evidence.versionId, teamId);
  const state = await renderState(version.id);
  if (version.contentType !== "application/pdf" || !version.hasPages || state?.status !== "ready" || state.sha256 !== evidence.sha256 || !version.file.startsWith(`${teamId}/core/`)) throw new HttpError(409, "Evidence version is not ready or its digest changed");
  const { client, config } = await getTeamS3ClientAndConfig(teamId);
  const object = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: version.file }));
  if (!object.Body || Number(object.ContentLength) > 20 * 1024 * 1024) throw new HttpError(409, "Evidence unavailable or too large");
  const reader = object.Body.transformToWebStream().getReader();
  const parts: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > 20 * 1024 * 1024) { await reader.cancel(); throw new HttpError(409, "Evidence unavailable or too large"); }
    parts.push(Buffer.from(value));
  }
  const bytes = Buffer.concat(parts);
  if (sha256(bytes) !== evidence.sha256) throw new HttpError(409, "Evidence stored bytes changed");
  return bytes;
}
