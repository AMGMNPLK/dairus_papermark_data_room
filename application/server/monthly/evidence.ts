import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getTeamS3ClientAndConfig } from "@/lib/files/aws-client";
import { HttpError, ownedVersion, renderState, sha256 } from "../core";
import { MonthlyFileSizeError, readMonthlyFileBytes } from "./bounded-bytes.mjs";

// This verifies bytes of an uploaded private PDF; it does not attest that the
// stated external source, date or business claim is authentic.
export async function readVerifiedEvidence(teamId: string, evidence: any) {
  if (!evidence || typeof evidence.versionId !== "string" || typeof evidence.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(evidence.sha256)) throw new HttpError(409, "Evidence requires an exact uploaded file version and digest");
  const version = await ownedVersion(evidence.versionId, teamId);
  const state = await renderState(version.id);
  if (version.contentType !== "application/pdf" || !version.hasPages || state?.status !== "ready" || state.sha256 !== evidence.sha256 || !version.file.startsWith(`${teamId}/core/`)) throw new HttpError(409, "Evidence version is not ready or its digest changed");
  const { client, config } = await getTeamS3ClientAndConfig(teamId);
  const object = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: version.file }));
  let bytes: Buffer;
  try { bytes = await readMonthlyFileBytes(object.Body, object.ContentLength); }
  catch (error) {
    if (error instanceof MonthlyFileSizeError) throw new HttpError(409, "Evidence unavailable or too large");
    throw error;
  }
  if (sha256(bytes) !== evidence.sha256) throw new HttpError(409, "Evidence stored bytes changed");
  return bytes;
}
