import { execSync } from "node:child_process";

// ponytail: single hardcoded port, this script only serves apps/simulation-server's predev hook
const PORT = 2567;

try {
  if (process.platform === "win32") {
    const out = execSync("netstat -ano -p tcp", { encoding: "utf8" });
    const pids = new Set(
      out
        .split("\n")
        .filter((line) => line.includes(`:${PORT} `) && line.includes("LISTENING"))
        .map((line) => line.trim().split(/\s+/).pop()),
    );
    for (const pid of pids) execSync(`taskkill /F /PID ${pid}`);
  } else {
    const out = execSync("ss -ltnp", { encoding: "utf8" });
    const pids = new Set(
      [...out.matchAll(new RegExp(`:${PORT}\\s.*pid=(\\d+)`, "g"))].map((m) => m[1]),
    );
    for (const pid of pids) execSync(`kill -9 ${pid}`);
  }
} catch {
  // nothing listening on the port, or the process already exited
}
