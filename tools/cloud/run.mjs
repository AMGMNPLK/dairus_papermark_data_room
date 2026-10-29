import { existsSync, mkdirSync, cpSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { root, loadCloudEnvironment, run } from "./common.mjs";

loadCloudEnvironment();
const mode = process.argv[2];
const next = path.join(root, "node_modules/next/dist/bin/next");
const standalone = path.join(root, "application/.next/standalone");
if (mode === "build") {
  run("npm", ["run", "build"], { env: { ...process.env, NODE_ENV: "production" } });
  const staticDir = path.join(standalone, "application/.next/static");
  mkdirSync(path.dirname(staticDir), { recursive: true });
  cpSync(path.join(root, "application/.next/static"), staticDir, { recursive: true });
  if (existsSync(path.join(root, "public"))) cpSync(path.join(root, "public"), path.join(standalone, "application/public"), { recursive: true });
  console.log("Standalone build and static assets prepared; no server started.");
} else {
  if (!["dev", "start", "pdf"].includes(mode)) throw new Error("Choose dev, build, start, or pdf.");
  let args, cwd = root;
  if (mode === "dev") args = [next, "dev", "application", "--webpack", "--hostname", "127.0.0.1", "--port", "3000"];
  if (mode === "pdf") args = [path.join(root, "application/pdf-worker.mjs")];
  if (mode === "start") {
    const server = path.join(standalone, "application/server.js");
    if (!existsSync(server)) throw new Error("Run cloud:build before cloud:start.");
    args = [server]; cwd = standalone;
  }
  const child = spawn(process.execPath, args, { cwd, stdio: "inherit", env: { ...process.env, NODE_ENV: mode === "dev" ? "development" : "production", HOSTNAME: "127.0.0.1", PORT: "3000" } });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  child.on("error", () => { console.error("Local runtime process could not start."); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 1; });
}
