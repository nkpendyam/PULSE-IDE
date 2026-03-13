import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const port = process.env.PORT || "3000";
const logPath = path.join(process.cwd(), "dev.log");
const logStream = fs.createWriteStream(logPath, { flags: "a" });

function commandExists(command, args = ["--version"]) {
  const result = spawnSync(command, args, { stdio: "ignore", shell: false });
  return result.status === 0;
}

function resolveRunner() {
  if (process.platform === "win32") {
    if (commandExists("bunx.cmd")) return "bunx.cmd";
    return "npx.cmd";
  }

  if (commandExists("bunx")) return "bunx";
  return "npx";
}

const command = resolveRunner();
const args = ["next", "dev", "-p", port];

logStream.write(`\n[${new Date().toISOString()}] Starting: ${command} ${args.join(" ")}\n`);

const child = spawn(command, args, {
  cwd: process.cwd(),
  env: { ...process.env, NODE_ENV: "development" },
  stdio: ["inherit", "pipe", "pipe"],
});

child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  logStream.write(chunk);
});

child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
  logStream.write(chunk);
});

child.on("close", (code) => {
  logStream.write(`[${new Date().toISOString()}] Dev process exited with code ${code}\n`);
  logStream.end();
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  process.stderr.write(`Failed to start dev process: ${error.message}\n`);
  logStream.write(`[${new Date().toISOString()}] Failed to start dev process: ${error.message}\n`);
  logStream.end();
  process.exit(1);
});
