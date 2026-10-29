// Durable application PDF queue, using native Prisma/S3/MuPDF. This worker
// polls ONLY this workspace's pending PDF versions, never coordination requests.
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const stateDir = process.env.PAPERMARK_STATE_DIR;
const teamId = process.env.PAPERMARK_TEAM_ID;
if (!stateDir || !teamId) throw new Error("Missing worker configuration");
const bucket = process.env.NEXT_PRIVATE_UPLOAD_BUCKET;
const s3 = new S3Client({
  endpoint: process.env.NEXT_PRIVATE_UPLOAD_ENDPOINT,
  region: process.env.NEXT_PRIVATE_UPLOAD_REGION,
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  credentials: {
    accessKeyId: process.env.NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID,
    secretAccessKey: process.env.NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY,
  },
});
const sha = (b) => createHash("sha256").update(b).digest("hex");
let stopping = false,
  child = null;
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    stopping = true;
    child?.kill("SIGTERM");
  });
async function status(id, value) {
  await fs.mkdir(stateDir, { recursive: true, mode: 0o700 });
  const temp = path.join(stateDir, `.${randomUUID()}.tmp`);
  await fs.writeFile(
    temp,
    JSON.stringify({ ...value, updatedAt: new Date().toISOString() }, null, 2) +
      "\n",
    { mode: 0o600, flush: true },
  );
  await fs.rename(temp, path.join(stateDir, `render-${id}.json`));
}
async function getState(id) {
  try {
    return JSON.parse(
      await fs.readFile(path.join(stateDir, `render-${id}.json`), "utf8"),
    );
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
async function immutablePut(key, bytes, type) {
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: type,
        IfNoneMatch: "*",
      }),
    );
  } catch (e) {
    if (e.$metadata?.httpStatusCode !== 412) throw e;
    const old = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    if (sha(Buffer.from(await old.Body.transformToByteArray())) !== sha(bytes))
      throw new Error("Stored page integrity mismatch");
  }
}
async function render(version) {
  let dir;
  try {
    if (
      !version.file.startsWith(`${teamId}/core/`) ||
      version.storageType !== "S3_PATH"
    )
      throw new Error("Invalid PDF storage scope");
    const object = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: version.file }),
    );
    if (Number(object.ContentLength) > 20 * 1024 * 1024)
      throw new Error("PDF exceeds 20 MB");
    const bytes = Buffer.from(await object.Body.transformToByteArray());
    const digest = sha(bytes);
    const before = await getState(version.id);
    if (before?.sha256 && before.sha256 !== digest)
      throw new Error("PDF integrity mismatch");
    await status(version.id, { status: "running", sha256: digest });
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "papermark-pdf-"));
    const input = path.join(dir, "source.pdf");
    await fs.writeFile(input, bytes, { mode: 0o600 });
    const result = await new Promise((resolve) => {
      child = spawn(
        process.execPath,
        [
          "--max-old-space-size=384",
          fileURLToPath(new URL("./pdf-render.mjs", import.meta.url)),
          input,
          dir,
        ],
        { stdio: ["ignore", "ignore", "pipe"] },
      );
      let message = "";
      child.stderr.on("data", (chunk) => {
        message = (message + chunk.toString()).slice(0, 300);
      });
      const timeout = setTimeout(() => child?.kill("SIGKILL"), 120000);
      child.once("error", () => {
        clearTimeout(timeout);
        resolve({ code: 1, message: "PDF process unavailable" });
      });
      child.once("close", (code) => {
        clearTimeout(timeout);
        child = null;
        resolve({ code, message });
      });
    });
    if (stopping) return;
    if (result.code !== 0)
      throw new Error(
        result.message.trim() ||
          "PDF conversion failed or exceeded its time limit",
      );
    const pages = JSON.parse(
      await fs.readFile(path.join(dir, "pages.json"), "utf8"),
    );
    for (const page of pages) {
      const key = `${teamId}/core/pages/${version.id}/${page.file}`;
      const png = await fs.readFile(path.join(dir, page.file));
      const metadata = { ...page.metadata, sha256: sha(png) };
      await immutablePut(key, png, "image/png");
      await prisma.documentPage.upsert({
        where: {
          pageNumber_versionId: {
            pageNumber: page.pageNumber,
            versionId: version.id,
          },
        },
        create: {
          versionId: version.id,
          pageNumber: page.pageNumber,
          file: key,
          storageType: "S3_PATH",
          embeddedLinks: [],
          metadata,
        },
        update: { file: key, metadata },
      });
    }
    await status(version.id, {
      status: "ready",
      sha256: digest,
      pageCount: pages.length,
    });
    await prisma.documentVersion.update({
      where: { id: version.id },
      data: {
        hasPages: true,
        numPages: pages.length,
        isVertical:
          pages[0].metadata.originalHeight > pages[0].metadata.originalWidth,
      },
    });
    if (version.isPrimary)
      await prisma.document.update({
        where: { id: version.documentId },
        data: { numPages: pages.length },
      });
    console.log(JSON.stringify({ event: "pdf-ready", pages: pages.length }));
  } catch (error) {
    if (!stopping) {
      // Only safe renderer/validation messages reach UI. SDK/database errors are generic.
      const message =
        error instanceof Error &&
        /^(PDF |Upload an unencrypted|Invalid PDF|Stored page)/.test(
          error.message,
        )
          ? error.message.slice(0, 180)
          : "PDF processing failed. Contact the operator.";
      await status(version.id, { status: "failed", error: message });
      console.log(JSON.stringify({ event: "pdf-failed" }));
    }
  } finally {
    if (dir) await fs.rm(dir, { recursive: true, force: true });
  }
}
try {
  while (!stopping) {
    try {
      const pending = await prisma.documentVersion.findMany({
        where: {
          hasPages: false,
          type: "pdf",
          document: { teamId },
          file: { startsWith: `${teamId}/core/` },
        },
        orderBy: { createdAt: "asc" },
        take: 20,
      });
      for (const version of pending) {
        if (stopping) break;
        const state = await getState(version.id);
        if (state?.status !== "failed") await render(version);
      }
    } catch {
      console.log(JSON.stringify({ event: "pdf-queue-unavailable" }));
    }
    for (let i = 0; i < 10 && !stopping; i++)
      await new Promise((resolve) => setTimeout(resolve, 500));
  }
} finally {
  await prisma.$disconnect();
  s3.destroy();
}
