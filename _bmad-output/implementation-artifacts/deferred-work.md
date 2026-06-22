# Deferred Work

Items surfaced during reviews that are real findings but pre-exist the triggering change or are out of scope for the current story. Each entry records the source story, the finding, and why it was deferred.

---

## From INFRA-001 — cascade auto-advance (2026-06-13)

**D1 — All-failed terminal state not handled in dispatch loop**
The loop exits when all shards are `status: complete OR failed`, but the "After All Developer Shards Complete" block only handles the all-complete case. A mixed or all-failed outcome routes to `step-04-merge.md` with no meaningful content. Pre-existing gap in the loop termination condition.

**D2 — EnterWorktree failure leaves shard in `pending`, loop may spin**
If `EnterWorktree` fails, the shard is never updated out of `pending`. On the next iteration the same shard is selected again, creating an infinite dispatch attempt. No error branch after step 2. Pre-existing.

**D3 — Retry ([R]) produces duplicate Phase Log entries**
When a user retries a shard, the agent appends a second Phase Log entry for the same role. "Latest entry" heuristic is sufficient in the happy path but accumulates noise across multiple retries. Needs Phase Log entry anchoring or shard-scoped markers. Pre-existing Phase Log design issue.

**D4 — Micro-shard confidence not included in final summary**
Micro-shards are created dynamically and are not in the original pipeline order list. The summary is undefined for them — include, exclude, or fold into parent shard's confidence? Needs a micro-shard tracking strategy.

**D5 — ExitWorktree failure after agent completion causes re-dispatch**
If `ExitWorktree` fails, the worktree stays open. The shard's status hasn't been written yet (step 7 runs after step 5). Next loop iteration selects the same shard and attempts `EnterWorktree` on an already-open branch. Pre-existing.

**D6 — No timeout or max-retry count on HALT responses**
If a session is closed mid-HALT and resumed, the workflow manager has no persisted "paused at HALT" state in the story file. It re-enters the loop and potentially re-dispatches completed shards. Needs a `dispatch_state: paused` field in story frontmatter or similar.

**D7 — Confidence tag format tolerance**
The `[confidence: N%]` tag is matched literally. Minor format variations (`[Confidence: 85%]`, `[confidence: 85 %]`) cause a false missing-tag HALT. A normalization step or regex tolerance note would prevent unnecessary interruptions. Pre-existing.

---

## From root-dev-script — add dev script to root package.json (2026-06-22)

**D15 — No startup ordering guarantee**
When packages evolve to ship compiled output rather than raw TypeScript source, `host-client` and `mobile-controller` may boot before workspace packages are ready. The `dev` script encodes no ordering guarantee. Pre-existing structural concern; not triggered by current scaffold.

**D16 — `backend-platform` always started in `npm run dev`**
Phase 2 (Local Party MVP) keeps cloud off the critical path, but `backend-platform` is included in the root `dev` command. Developers who only want local gameplay must have Redis available. Consider splitting into `dev:local` (sim + host + mobile) and `dev:full` in a later story.

**D17 — No `engines.npm` field**
The `-w` workspace flag requires npm ≥ 7. The project has no `engines.npm` constraint, so a developer on an older npm gets a confusing failure. Pre-existing.

---

## Deferred from: code review of 1-1-monorepo-architecture-clean-slate-and-package-scaffold (2026-06-22)

**D8 — `deserialize<T>` unsafe cast** (`packages/net-protocol/src/serialize.ts`)
`JSON.parse` returns `unknown`; casting directly to `T` is a false type-safety guarantee — a malformed payload silently passes the type checker. Acceptable for Phase 1. Add schema validation (e.g. Zod) in Phase 5 when the wire protocol is finalized.

**D9 — `deserialize` error leaks raw input** (`packages/net-protocol/src/serialize.ts`)
The thrown `SyntaxError` includes the first 80 characters of the raw input, which could leak network payload content into logs. Game input is not sensitive in Phase 1; revisit if PII or auth tokens ever flow through this path.

**D10 — `simulation-server` missing `start` script** (`apps/simulation-server/package.json`)
No `"start": "node dist/index.js"` script defined. Needed for production deployment gate. Deferred to Story 1.2, which defines the actual server implementation and entrypoint.

**D11 — `DeltaEventMsg` missing `tick` field** (`packages/net-protocol/src/messages/server-to-host.ts`)
All delta event variants lack a `tick: number` field, so clients cannot order or deduplicate out-of-order events. Not needed until Phase 5 (prediction/reconciliation). Ticket for Story 5.x.

**D12 — `@colyseus/ws-transport` not a declared dependency** (`apps/simulation-server/package.json`)
Colyseus 0.17 requires an explicit transport to be registered at server construction; without it, the server throws at startup. No runtime exists in Story 1.1 (scaffold only). Deferred to Story 1.2.

**D13 — `runSeed: number` wrong type for xoshiro128++** (`packages/shared-types/src/session.ts`)
xoshiro128++ needs 4×32-bit unsigned integer state; a plain `number` (IEEE 754 double) loses precision above 2^53, silently corrupting deterministic replay for large seeds. Deferred to Story 3.1 when the PRNG is implemented — change type to `Uint32Array` or encode as four separate fields.

**D14 — `@colyseus/redis-presence` in production `dependencies`** (`apps/simulation-server/package.json`)
This package attempts a Redis connection on import. In Phase 1 local mode, no Redis is available. Should be optional (environment-gated) or moved to `devDependencies`. Deferred to Story 1.2.
