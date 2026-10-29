import { S3Client, CreateBucketCommand, HeadBucketCommand, PutBucketVersioningCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { loadCloudEnvironment } from "./common.mjs";
loadCloudEnvironment({ seeding: true });
const client = new S3Client({ endpoint: process.env.NEXT_PRIVATE_UPLOAD_ENDPOINT, region: process.env.NEXT_PRIVATE_UPLOAD_REGION, forcePathStyle: true, requestChecksumCalculation: "WHEN_REQUIRED", credentials: { accessKeyId: process.env.NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID, secretAccessKey: process.env.NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY } });
const Bucket = process.env.NEXT_PRIVATE_UPLOAD_BUCKET;
try { await client.send(new HeadBucketCommand({ Bucket })); }
catch (error) { if (error.$metadata?.httpStatusCode !== 404) throw new Error("Local S3 service is not ready or access was refused."); await client.send(new CreateBucketCommand({ Bucket })); }
await client.send(new PutBucketVersioningCommand({ Bucket, VersioningConfiguration: { Status: "Enabled" } }));
// Bucket metadata alone does not prove that the local volume server can write.
const Key = `${process.env.PAPERMARK_TEAM_ID}/cloud-health/${randomUUID()}.txt`;
const Body = Buffer.from("Synthetic local storage health check only.\n");
await client.send(new PutObjectCommand({ Bucket, Key, Body, ContentType: "text/plain", IfNoneMatch: "*" }));
const object = await client.send(new GetObjectCommand({ Bucket, Key }));
if (!Body.equals(Buffer.from(await object.Body.transformToByteArray()))) throw new Error("Local S3 byte-integrity check failed.");
let conflict = false;
try { await client.send(new PutObjectCommand({ Bucket, Key, Body, ContentType: "text/plain", IfNoneMatch: "*" })); }
catch (error) { if (error.$metadata?.httpStatusCode !== 412) throw error; conflict = true; }
if (!conflict) throw new Error("Local S3 did not preserve the immutable-create condition.");
console.log("Local synthetic bucket passed versioning setup, conditional create, byte readback and collision refusal. One private text health object retained; no public policy or document/link created.");
