import { spawn, type ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// tests/helpers/ → repo root is two levels up
const REPO_ROOT = join(__dirname, '../..');
const SIM_DIR = join(REPO_ROOT, 'apps/simulation-server');
const TSX_BIN = join(REPO_ROOT, 'node_modules/.bin/tsx');

export const TEST_PORT = 2568; // avoids conflict with dev server on :2567
export const TEST_URL = `ws://localhost:${TEST_PORT}`;

let serverProcess: ChildProcess | null = null;

export async function startTestServer(port = TEST_PORT): Promise<void> {
  serverProcess = spawn(TSX_BIN, ['src/index.ts'], {
    cwd: SIM_DIR,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
    // ponytail: own process group so we can kill tsx's spawned node child too —
    // tsx's cli.mjs spawns a separate grandchild to actually run the script, and
    // killing only the outer PID leaves that grandchild running as a WSL2 orphan.
    detached: true,
  });

  return new Promise((resolve, reject) => {
    let resolved = false;
    const done = (err?: Error) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      err ? reject(err) : resolve();
    };

    const timeout = setTimeout(
      () => done(new Error('simulation-server did not start within 60s')),
      60_000
    );

    serverProcess!.stdout!.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('listening')) done();
    });

    serverProcess!.stderr!.on('data', (chunk: Buffer) => {
      process.stderr.write(chunk);
    });

    serverProcess!.once('error', (err) => {
      done(new Error(`server process error: ${err.message}`));
    });

    serverProcess!.once('exit', (code, signal) => {
      if (resolved) return;
      if (signal) {
        done(new Error(`server killed by signal ${signal} before listening`));
      } else if (code !== 0) {
        done(new Error(`server exited with code ${code ?? 0} before listening`));
      }
      // code === 0 before listening is handled by the 60s timeout above
    });
  });
}

export async function stopTestServer(): Promise<void> {
  const proc = serverProcess;
  serverProcess = null;
  if (!proc || proc.exitCode !== null || !proc.pid) return;
  // ponytail: kill the whole process group (negative pid) — tsx's cli.mjs spawns
  // its own node child to run the script, so killing only proc.pid orphans that
  // child instead of stopping it.
  return new Promise<void>((resolve) => {
    proc.once('exit', () => resolve());
    try {
      process.kill(-proc.pid!, 'SIGKILL');
    } catch {
      proc.kill('SIGKILL');
    }
    setTimeout(resolve, 2_000); // safety fallback
  });
}
