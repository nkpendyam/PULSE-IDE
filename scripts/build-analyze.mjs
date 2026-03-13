import { spawn } from "node:child_process";

const child = spawn("next", ["build"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    ANALYZE: "true",
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
