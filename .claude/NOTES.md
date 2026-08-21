# Code review notes — rapidrest/core

This file exists so that Claude sessions working in this repo don't re-litigate settled
decisions or re-discover the same issues from scratch. It is local to this repo (not tied to
any one machine's global Claude memory), so it travels with the code.

**Maintenance rule:** when a standing decision changes, update the section below in place
(don't just append a contradiction lower down). When a new investigation/session produces a
decision, finding, or reverted approach worth remembering, add a dated entry under Session Log.
Keep entries terse — this is a reference, not a transcript.

## What this library is

`rapidrest/core` is **not** a standalone web server. It's a developer-facing utility toolkit
consumed as a dependency by the larger `rapidrest` framework, which developers use to build REST
APIs and backend apps. Its consumers are application developers writing code, not end users of
those apps directly. This distinction is the single most important thing to get right when
judging whether something is a security vulnerability — see the calibration rule below.

## The calibration rule for security findings

Do not flag something as a vulnerability just because an input **could theoretically** be
attacker-controlled. For every candidate finding, name a **concrete, plausible REST API feature**
that a normal developer building an app with this framework would implement, where client-request
data flows into the vulnerable code path. If you can't name that feature, it's not a vulnerability
— classify it as one of:

1. **Genuine client-reachable vulnerability** — report it.
2. **Developer footgun** — unsafe only if fed untrusted input, but realistic callers are always
   trusted/internal/config-driven (e.g. startup/bootstrap code, not a request handler). Don't
   report as a vulnerability; a one-line mention is fine if worth noting.
3. **Already-settled design decision** — see the list below. Don't re-flag.

Five full review passes (four security+correctness/perf agent pairs, one earlier confirmation-only
pass) have been run against this codebase under this calibration. The reachable surface is now
genuinely well-picked-over — a review that finds nothing new is an expected, good outcome, not a
sign the review was insufficient. Don't manufacture findings to have something to report. The 5th
pass's security lens found nothing new; its correctness/performance lens found the two
`ObjectFactory.ts`/`Logger.ts` issues listed below, which were fixed in that pass.

A 6th pass (single-reviewer, not the two-agent methodology below) covered the `RedisStore.ts` /
`MemoryStore.ts` ioredis→node-redis migration plus the new bulk (`*Many`) and set (`*Set`) operations
added alongside it — see the entries below dated "6th pass". No new security findings; all findings
were correctness bugs in the newly-added code, confirmed via `tsc --noEmit` (one was an outright build
break) and/or direct tracing, not speculative.

A 7th pass (back to the two-agent methodology) covered all 28 files in `src/`, including the two files
added since the 5th pass (`RedisStore.ts`, `SimpleStore.ts`) that no prior *adversarial* pass had ever
looked at (the 6th pass above was a lighter single-reviewer sweep focused narrowly on the
ioredis→node-redis migration diff, not a full adversarial pass over that code). Both agents were told
to weight `RedisStore.ts`/`SimpleStore.ts`/`MemoryStore.ts` most heavily and give the other 25
(already-reviewed) files a lighter confirmatory pass. Result: nothing new in the 25 already-reviewed
files; three genuine new findings, all in the `sets: Map` side of `RedisStore.ts`/`MemoryStore.ts`
(a second, unmanaged cache sitting alongside the carefully-bounded `entries` map, added by the 6th
pass's bulk/set work but never given the same TTL/size discipline) plus one Redis key-namespacing gap
in `RedisStore.ts` — see the entries below dated "7th pass". All three fixed, with regression tests
covering set-TTL expiry, set-cache size eviction, and the key-encoding fix.

An 8th pass (two-agent, same 28 files, again weighted toward re-checking `RedisStore.ts`/
`MemoryStore.ts`/`SimpleStore.ts` since they were the most recently/heavily changed) found the 7th
pass's fixes fully verified airtight by the security lens (no new security findings at all), but the
correctness lens found one more instance of the exact bug class the 6th pass had already fixed in
`saveMany()` — `loadMany()`'s redis-fallback path still used the old "precompute one batch eviction
count" approach and had the same failure mode, just triggered by a different condition (a fetched batch
larger than `maxSize`, rather than a batch overlapping already-cached ids). See the entry below dated
"8th pass". Fixed the same way `saveMany()` was fixed — reverted to per-id check→evict→insert — with a
regression test (`loadMany` with a 5-id batch against `maxSize = 2`) that fails against the old code.

## Settled design decisions — do NOT re-flag these

- **`ClassLoader.load()`'s `dir`/`rootDir` have no path-containment/symlink checks.** This is
  intentional (there's a prominent comment at the top of `load()` explaining it). These values are
  always supplied by application startup/bootstrap code (e.g.
  `new ClassLoader("./src/models").load()`), never derived from a client request — there's no sane
  REST endpoint where a caller picks which directory of code the server dynamically imports and
  executes. A containment check used to be enforced here and was **removed** because it broke
  legitimate symlinked plugin/workspace directories for zero real benefit.
- **`Logger`'s log messages are not sanitized for CR/LF.** Also intentional — CR/LF stripping was
  added, then reverted after discussion. Log-injection mitigation belongs at the specific call site
  logging untrusted data (where the developer knows the field is untrusted), not as a blanket tax
  on every log call in the library. No mainstream Node logger (winston, pino, bunyan) strips
  newlines by default either.
- **`ObjectUtils`'s `new clazz()` pattern (building a metadata-reading instance) is safe.** This
  framework's DTO contract *requires* every DTO class to have a no-required-args constructor
  (`constructor(other?: any) { ... }`), so instantiating with zero arguments never throws or has
  side effects. Don't flag this as "what if the constructor requires arguments."
- **`FileUtils`'s opt-in `rootDir` parameter and `OASUtils.loadSpec`'s opt-in
  `allowedDirs`/`allowedHosts` are correct and sufficient as opt-in guards.** Don't suggest making
  them mandatory, and don't re-flag their mere existence. They exist specifically because "accept a
  filename/spec-path/URL from a caller and read/write/fetch it" (file upload/download, a spec
  registry/gateway feature) is a normal, plausible client-reachable REST feature — unlike
  `ClassLoader`'s directory-of-code-to-import, which isn't.
- **`TelemetryUtils.EventUtils` is an intentional process-wide singleton, initialized exactly once
  at application startup, and stays active for the server's entire lifetime.** It has no
  token-rotation method and `init()` resets `listeners`. This is **not a bug** — re-initializing it
  mid-lifecycle is outside its intended usage contract, so "re-init wipes listeners" /
  "no way to rotate the token without wiping listeners" is not worth flagging. (This was raised and
  explicitly dismissed in review pass 4 for exactly this reason.)
- **`MessagingUtils.sendEmail`/`sendSMS`'s `options` passthrough to nodemailer/twilio** only
  protects `from`/`subject`/`text`/`html`/`body` from override; other fields (e.g. nodemailer's
  `attachments[].path`) pass through untouched. This is intended flexibility, not a bug — it's only
  a problem if a developer naively forwards a raw client request body as `options`, which is a
  footgun to note in docs, not something to fix in the library.
- **`ValidationUtils.checkURL`/`checkPhone` are thin wrappers** around `validator.isURL`/
  `isMobilePhone` with default options. They don't reject private/internal hosts and aren't SSRF
  protection despite what their names might suggest. Footgun to note (the name could mislead a
  developer into treating validation as a security control), not a library bug to fix.

## Issues found and fixed across prior passes (already resolved — don't re-report)

**`ThreadPool.ts`**
- Dead workers (crashed with no `restartOnExit`) used to crash `stop()`/`sendAll()`/`send()`/
  `sendTo()` via an unguarded `postMessage()` on an exited worker, leaking every other running
  worker. Fixed via an `exitedWorkers` `WeakSet` guard.
- `start()`/`createWorker()` used to mutate the caller's `options` object in place (`allowTs`,
  `entry`). Fixed — `start()` now copies into a local `resolvedOptions` before use.

**`StringUtils.ts`**
- `findAndReplace` used to mutate the caller's `variables` object (rewriting null/undefined values
  to `""` in place). Fixed — builds a local `values` copy instead.
- `replaceAll` used to produce garbage output (embedding numeric match offsets) for any pattern
  without a capture group — including its own documented plain-string overload, which can never
  have one. Fixed by counting capture groups up front and falling back to whole-match-replaced-by-
  `prefix` semantics when there isn't one.

**`AlertUtils.ts`**
- `send()`/`close()` used to mutate the caller's `alert`/`data` object in place (template
  substitution, truncation), breaking reuse of an `Alert` as a template across multiple `send()`
  calls. Fixed — both now copy into a local `payload` before mutating.

**`OASUtils.ts`**
- `loadSpec`'s cache was keyed by the raw `file` argument instead of the resolved/validated path,
  so two calls passing the same relative `file` string against different `allowedDirs` could
  collide and return each other's content. Fixed — cache key is now `resolvedFile ?? file`.
- `loadSpec` used `fs.existsSync`/`fs.readFileSync` (blocks the event loop). Converted to
  `fs/promises`.
- `loadSpec` cached and returned the *same* object reference on every call, so a caller mutating
  the returned spec (e.g. resolving `$ref`s, a normal OpenAPI-tooling step) silently corrupted
  every future cache hit for that file/URL. Fixed — every return (fresh parse or cache hit) is now
  `structuredClone`'d.
- `_specCache` evicted strictly FIFO, so a cache *hit* didn't protect a frequently-reused entry
  from eviction. Fixed — a hit now does delete+reinsert to move the entry to the end of the Map's
  iteration order.

**`MessagingUtils.ts`**
- `loadTemplate` never invalidated a compiled Handlebars delegate when a template field was
  cleared/emptied (e.g. a live config reload), continuing to serve stale rendered output. Fixed.
- `loadTemplate` used `fs.existsSync`/`fs.readFileSync` on the message-send path (blocks the event
  loop for every in-flight request). Converted to `fs/promises`; **`loadTemplate` is now `async`
  and returns `Promise<Template>`** (breaking signature change — all call sites, including tests,
  were updated to `await` it).

**`MemoryStore.ts`**
- `save()` on an existing key didn't move it to the end of the underlying `Map`'s iteration order
  (`Map.set()` on an existing key doesn't reorder it), so `evictOldest()` could evict an
  actively-renewed entry ahead of a genuinely idle one. Fixed — `save()` now deletes then
  re-inserts.

**`ObjectUtils.ts`**
- `_deleteScopedProps`/`_validate` had unbounded recursion depth with `recurse: true` (only cycle
  detection, no depth cap) — a deeply-nested-but-non-cyclic object (e.g. attacker-controlled JSON)
  could exhaust the call stack. Fixed — capped at `MAX_RECURSE_DEPTH = 50`, throws a clear error
  past that.

**`JWTUtils.ts`**
- `hybridDecrypt` destructured `encoded.split(".")` into 4 parts with no length check (unlike the
  password-decryption path, which validates `parts.length !== 3`). A malformed profile threw an
  untyped `TypeError` instead of a clear error. Fixed — now validates `parts.length !== 4` first.
- `finalizePayload`'s `zlib.gunzipSync` had no output-size cap — a decompression-bomb vector if a
  less-trusted signer ever shared the verification secret. Fixed — capped via `maxOutputLength`
  (`MAX_DECOMPRESSED_PROFILE_BYTES`, 10MB).
- `deriveKey`/`deriveKeySync` hard-coded a 24-byte scrypt key length, which only satisfies
  AES-192 — configuring password-based payload encryption with the far more common AES-256 (or
  AES-128) threw `Invalid key length` on every `createToken`/`decodeToken` call. Fixed — key length
  is now resolved per-algorithm via `crypto.getCipherInfo(algorithm)`, with a clear error for an
  unrecognized algorithm instead of an opaque crypto error.

**`ClassLoader.ts`**
- Previously had a mandatory path-containment/symlink-escape check on `dir`/`rootDir`. **Removed**
  — see "Settled design decisions" above. This is a deliberate design reversal, not a gap.

**`Logger.ts`**
- `_loggerCache` evicted strictly FIFO (same class of bug as `OASUtils._specCache` above — a hit
  didn't protect an entry from eviction, so a hot logger could be evicted, and its file transport
  closed possibly mid-write, purely because 100 other loggers were created after it). Fixed with
  the same delete-then-reinsert-on-hit pattern.
- CR/LF stripping from log messages was added then reverted — see "Settled design decisions."

**`ObjectFactory.ts`**
- `newInstance()` registered the new instance in `instances`/`_firstByClass` before its (possibly async)
  `initialize()` call completed — necessary so circular `@Inject` dependencies don't recurse forever, but with
  two unguarded consequences: (1) if initialization failed (a synchronous throw, e.g. a missing required
  `@Config` path, or an async-rejecting `@Init` method), the broken instance was never removed from the
  registry, so every later `newInstance()` call for that name silently returned the same zombie object forever
  via the fast path, with no error; (2) a concurrent `newInstance()` call for the same name, made while the
  first call's async initialization was still pending, hit the "already exists" fast path and got back the raw,
  not-yet-initialized instance synchronously instead of waiting for it. Fixed — a new `_pendingInit` map tracks
  the in-flight initialization promise per name so a concurrent caller awaits the same promise instead of the
  raw instance, and on any initialization failure (sync or async) the instance is now removed via a new
  `_removeInstance()` helper (also now shared by `destroy()`) so a later call gets a clean retry instead of the
  broken object.

**`Logger.ts`**
- `format.colorize()` was part of the single logger-level `format` shared by the Console transport and both
  File transports (winston applies a logger-level `format` to any transport that doesn't supply its own
  override). Every file-bound logger (i.e. every `Logger(level, file)` call, which is the entire point of the
  `file` parameter) wrote ANSI escape codes into `*.log`/`*error.log` on disk, corrupting them for `grep`/log
  shippers/aggregators expecting a plain-text level field. Fixed — the logger-level `format` is now the
  uncolored base (so File transports, and any transport a caller adds later via `logger.add()`, still inherit
  sensible plain-text formatting), and only the Console transport gets its own overriding format with
  `colorize()` added.

**`RedisStore.ts`**
- `save()` called `this.client.setex(id, JSON.stringify(data), ttl)` — ioredis's `setex` signature is
  `setex(key, seconds, value)`, so the seconds/value arguments were swapped. Every `save()` against a
  real Redis server would reject (non-integer `seconds` argument) or, if that ever changed shape,
  silently store the wrong value. Fixed — arguments reordered to `setex(id, ttl, JSON.stringify(data))`.
- `load()` returned `undefined` (and deleted the local entry) purely because the *local* cached copy
  had expired, without ever consulting Redis — the actual source of truth for this hybrid store. Since
  another process can renew a key in Redis with a longer TTL without this instance knowing, a locally-
  expired-but-still-valid-in-Redis entry produced a false "not found." Fixed — on local expiry the
  stale local entry is dropped and the method falls through to the Redis fallback path instead of
  returning early.
- `load()`'s Redis-fallback path unconditionally added the fetched entry to the local `entries` map
  with no `maxSize` check (unlike `save()`, which sweeps/evicts before inserting). Since `load()` is a
  normal read path, repeatedly loading distinct ids already present in Redis grew the local map without
  bound regardless of `maxSize`. Fixed — `load()` now applies the same sweep-then-evict-to-maxSize logic
  as `save()` before inserting.
- `save()` updated the local `entries` map *before* awaiting the Redis `setex` call. If the Redis write
  failed (bad connection, or the argument-order bug above), the promise rejected but the local cache had
  already been mutated to reflect the "saved" value — leaving this instance's local cache diverged from
  Redis (and from any other instance/process reading the same keys) even though the caller was told the
  save failed. Fixed — the Redis write now happens first; the local cache is only updated on success.

**`RedisStore.ts` — ioredis→node-redis migration + bulk/set operations (6th pass)**
- `load()`/`loadMany()` used `.execAsPipeline()` (untyped, generic `T = MULTI_REPLY['GENERIC']`) whose
  return type is `Array<ReplyUnion>`, not the inferred per-command tuple. This didn't just look wrong —
  `tsc --noEmit` actually failed on it (`JSON.parse(data)` / `ttl * 1000` against a `ReplyUnion`). Fixed
  in `load()` by switching to `.execAsPipelineTyped()` (properly typed for its fixed 2-command chain); in
  `loadMany()`'s dynamically-built pipeline the tuple can't be statically inferred anyway, so it stays on
  `.execAsPipeline()` with the per-element cast routed through `unknown` first, as TS's own error message
  suggests, instead of the direct (invalid) cast that was there.
- `saveSet()` cached `this.sets.set(this.baseKey + id, records)` — the *full records*, not the id list.
  Every other read path (`loadSet()`'s local-cache fast path, the Redis-fallback path, and
  `MemoryStore`'s equivalent) treats this map's values as an array of raw ids and passes it straight to
  `loadMany()`. Concretely: `saveSet("s", data)` followed immediately by `loadSet("s")` in the same
  process — the normal write-then-read pattern — hit the local-cache fast path with full objects instead
  of ids, string-concatenated each object into the nonsense key `"...[object Object]"`, and returned
  `undefined` for every record. Fixed — stores `ids`, matching every other path.
- `saveSet()` filtered out records with a falsy `idProp` value (`if (id)`), silently dropping a
  legitimately-id`0` record. Fixed to check `!== undefined && !== null` instead (also aligned
  `MemoryStore.saveSet()` to the same check — see below).
- `saveMany()`'s eviction pre-computed a single "evict N, then insert the whole batch" step sized to
  `ids.length` (or, in an intermediate fix, to the count of ids not yet in `entries`). Both versions could
  still evict a *live entry that is itself one of the ids in the current batch* (already cached, just
  being renewed) — that id gets reinserted immediately after anyway, so the eviction bought no real room,
  and the final map ends up larger than `maxSize`. `loadMany()`'s equivalent batch (the redis-fallback
  "toSave" list) doesn't have this failure mode, since every id there is guaranteed to be a genuine local
  miss (never already in `entries`) — only `saveMany()` (and transitively `saveSet()`, which calls it)
  can be handed ids that overlap already-cached keys. Fixed by reverting `saveMany()` to the same
  per-id "check→sweep/evict→insert" pattern `save()` already uses (proven correct there), rather than
  trying to precompute a batch eviction count.
- `deleteMany([])` reached Redis's `DEL` with zero keys, which the server rejects
  (`ERR wrong number of arguments`). Fixed with an early return for an empty `ids` array (mirrors
  `MemoryStore.deleteMany()`, which already no-ops on empty input).
- `clear()`'s scan-key accumulation used `keys = keys.concat(results)` per page, which is O(n²) over a
  large keyspace. Changed to `keys.push(...results)`. Minor, but free to fix while in the file.

**`MemoryStore.ts` — bulk/set operations (6th pass)**
- `saveSet()` derived each record's id via `String(record[idProp])` unconditionally. Every record missing
  `idProp` produced the same key, the literal string `"undefined"` — so two or more such records in one
  `saveSet()` call silently overwrote each other in `entries`, and the `ids` array recorded that key
  multiple times. `RedisStore.saveSet()` already skipped these records instead; `MemoryStore` didn't,
  making the two `SimpleStore` implementations behave differently for the same input. Fixed —
  `MemoryStore.saveSet()` now skips records whose `idProp` is `undefined`/`null`, matching `RedisStore`.

**`RedisStore.ts` / `MemoryStore.ts` — `sets` map had no TTL or size bound (7th pass)**
- Both classes maintain a second map, `sets: Map<string, ...>`, alongside the carefully-bounded
  `entries` map, used by `saveSet()`/`loadSet()`/`deleteSet()`. Unlike `entries`, `sets` had no size
  cap, no expiry metadata, and was never touched by `sweep()` (which only iterated `entries`). Every
  `saveSet()` call (and, in `RedisStore`, the Redis-fallback branch of `loadSet()`) did an unconditional
  `.set()` with no `maxSize` check and no TTL tracking, so entries accumulated forever — any app calling
  `saveSet`/`loadSet` with a per-request/per-user/per-query set id (a normal usage pattern; `SimpleStore`'s
  own docstring frames it as a store with "a specified lifetime (TTL) and size") grows this map without
  bound regardless of the configured `maxSize`, an unbounded-memory-growth DoS. Separately, in
  `RedisStore` specifically, `loadSet()`'s local-cache fast path had no expiry check at all — once
  populated, a set was served from the local cache *forever*, never re-consulting Redis, unlike every
  other read path in the class (`load()` explicitly falls through to Redis on local expiry specifically
  so one process's stale cache can't shadow a newer value another process wrote). Fixed in both files:
  `sets` now stores `{ ids, expiresAt }` (new `MemoryStoreSetEntry` type in `SimpleStore.ts`), `sweep()`
  reclaims expired `sets` entries the same way it reclaims `entries`, `saveSet()`/`loadSet()` apply the
  same sweep-then-evict-to-`maxSize` guard `save()` already uses, and `RedisStore.loadSet()`'s local hit
  now checks `expiresAt` and falls through to Redis (fetching the real remaining TTL via the same
  `multi().get(id).ttl(id)` pattern `load()` uses) once expired, instead of serving the local copy
  unconditionally.

**`RedisStore.ts` — `baseKey` + `id` string concatenation could spoof a different store's namespace (7th pass)**
- Every key-building call site (`delete`, `load`, `save`, `saveMany`, `saveSet`, etc.) built the actual
  Redis/local-cache key via plain `this.baseKey + id` concatenation, with no delimiter enforcement and no
  sanitization of the caller-supplied `id`. `baseKey` exists specifically so multiple `RedisStore`
  instances can share one Redis backend without colliding, and hierarchical, colon-delimited `baseKey`s
  are idiomatic Redis key naming (e.g. `"user:"` vs `"user:session:"`). Concretely: an app exposes a
  client-controlled id in one low-privilege store (`draftStore = new RedisStore("user:", client)`,
  `POST /api/drafts/:draftId` → `draftStore.save(req.params.draftId, req.body)`) alongside a second,
  security-sensitive store using a hierarchical prefix (`sessionStore = new RedisStore("user:session:",
  client)`). An attacker sets `draftId = "session:<targetSessionId>"`; `draftStore.save()` then writes
  the literal Redis key `"user:session:<targetSessionId>"` — exactly the key `sessionStore` reads for
  that session — letting the attacker overwrite session data through an unrelated, low-privilege
  endpoint. Fixed — added a private `_key(id)` helper used by every key-building call site that
  percent-encodes the id (`encodeURIComponent`) before appending it to `baseKey`, so a caller-supplied id
  can never contain a literal `:` (or `/`, etc.) that reintroduces another namespace's delimiter. Ids made
  only of unreserved characters (the common case — alphanumeric ids, UUIDs) are unaffected, since
  `encodeURIComponent` is the identity function on those.

**`RedisStore.ts` — `loadMany()`'s redis-fallback batch eviction undercounted for a batch larger than `maxSize` (8th pass)**
- Same bug class the 6th pass already fixed in `saveMany()` (see below), reintroduced by a different
  trigger in the sibling `loadMany()` method: its redis-fallback path precomputed a single eviction count
  via `overflow = this.entries.size + toSave.length - this.maxSize`, then capped it at
  `Math.min(overflow, this.entries.size)` before the unconditional insert loop. When the batch of ids
  found in Redis (`toSave`) is itself larger than `maxSize` — a normal outcome of a bulk `loadMany()`
  against a store with a small/default `maxSize`, not an edge case — capping eviction at the map's
  *current* size evicts too little (e.g. `entries.size = 0`, `maxSize = 2`, `toSave.length = 5` →
  `overflow = 3`, capped to `Math.min(3, 0) = 0` evictions), and the loop then unconditionally inserts
  every item in `toSave`, leaving `entries.size` far above `maxSize`. Fixed the same way `saveMany()` was
  fixed — reverted to a per-id "check→sweep/evict→insert" loop identical to `save()`'s, instead of
  precomputing a batch eviction count, so `entries.size` can never exceed `maxSize` regardless of how
  large a single `loadMany()` batch is.

**`NotificationsUtils.ts`**
- `broadcastMessage()` published to a hardcoded `"allusers"` channel, and `sendMessage(uids, ...)`
  published directly to a channel named after the caller-supplied `uid`, with no namespace
  separation. A client-facing "send a direct message to this uid" feature
  (`POST /messages { to, text }` → `sendMessage(req.body.to, ...)`) let a client set
  `to: "allusers"` and turn a scoped 1:1 message into a broadcast every subscriber received. Fixed
  — `broadcastMessage` now publishes to `NotificationUtils.BROADCAST_CHANNEL`
  (`"broadcast:allusers"`) and `sendMessage` prefixes every recipient channel with
  `NotificationUtils.USER_CHANNEL_PREFIX` (`"user:"`), so the two namespaces can never collide
  regardless of what uid a caller supplies.

## Review methodology used

Each two-agent pass reviewed every file in `src/` independently and in full (not sampled) — 26 files
through the 5th pass; 28 from the 7th pass onward, after `RedisStore.ts`/`SimpleStore.ts` were added:
- One with a security/attacker lens, calibrated to the client-reachability rule above.
- One with a correctness/performance lens, looking for logic bugs, concurrency issues, memory
  leaks, performance bottlenecks, and resource-lifecycle bugs — with particular attention to the
  "mutates the caller's input object" bug class, which recurred across multiple unrelated files
  (`StringUtils`, `AlertUtils`, `ThreadPool`) before it stopped showing up, and (from the 7th pass on)
  the "unmanaged cache with no TTL/size bound sitting next to a properly-bounded one" bug class first
  seen in `RedisStore.ts`/`MemoryStore.ts`'s `sets` map.

Every finding from every agent was independently re-verified against the actual source (and, where
practical, against a runnable Node repro) before being accepted or fixed — agent output was never
taken at face value. Findings that didn't survive that verification, or that turned out to rest on
a threat model that doesn't apply to this library, were dropped rather than fixed; see "Settled
design decisions" for the ones worth remembering explicitly.

Later passes explicitly pointed the agents at files that got less attention in earlier rounds
(`ApiError.ts`, `CacheUtils.ts`, `ObjectFactory.ts`, `UserUtils.ts`, `ValidationUtils.ts`,
`decorators/ObjectDecorators.ts`, `TelemetryUtils.ts`, `ThreadWorker.ts`, `ThreadLogger.js`) to
avoid re-covering the same heavily-patched files every time at the expense of everything else. The
7th pass applied the same idea to new files instead of under-reviewed old ones: when the codebase
gains files between passes, point both agents at the new files first and let the already-reviewed
files get a lighter confirmatory pass, rather than spreading equal effort as if every file were
equally unreviewed.
