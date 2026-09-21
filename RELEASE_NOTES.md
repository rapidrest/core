# Release Notes

## v6.0.0

* **Breaking:** `MessagingUtils` SMS configuration moved from the top-level `twilio` key to a new
  `sms_config` key, which names the provider in `provider` and holds its settings in `config` — move
  your Twilio settings to `sms_config: { provider: twilio, config: { accountSid, token } }`. The old
  `twilio` key is now ignored, so `sendSMS()` will fail until it is migrated
* **Breaking:** `MessagingUtils.sendSMS()` now throws `SMS is not configured.` instead of
  `Twilio is not configured.` when no SMS provider is configured
* Added Telnyx as an alternative SMS provider to Twilio (`sms_config.provider: telnyx`), sending through
  the Telnyx Messaging API with `axios`, so no additional package is needed
* Added `MessagingUtils.sendWhatsApp()`, which sends free-form text or approved message templates through
  Meta's WhatsApp Business Cloud API. Configure it with the new `whatsapp` key and the new `whatsapp`,
  `whatsapp_template` and `whatsapp_options` template fields
* Errors from the Telnyx and WhatsApp APIs now include the provider's own explanation of the failure in
  the thrown message

## v5.2.2

## v5.2.1

* ClassLoader now loads files synchronously instead of in parallel. This fixes an issue with race conditions on module imports
* Fixed issue with Logger transport that suppressed call stack errors

## v5.2.0

* Fix JWTUtils.createToken() rejecting any asymmetric signing secret

## v5.1.0

* Upgraded all dependencies
* Fixed multiple issues with CI workflows

## v5.0.0

* Switched from MIT license to MPLv2.0

## v4.1.0

* `RedisStore` and `MemoryStore` now enforce a maximum size and TTL-based expiry on stored record sets
  (`saveSet`/`loadSet`), matching the existing behavior for individual records
* `RedisStore` now percent-encodes ids before building Redis keys, preventing a caller-supplied id
  from spoofing a different `baseKey`'s namespace
* Fixed a bug where `RedisStore.loadMany()` could leave more entries in the local cache than `maxSize`
  allows when fetching a batch larger than `maxSize` from Redis

## v4.0.0

* **Breaking:** `RedisStore` now uses the `redis` package (node-redis) instead of `ioredis` — update
  the `redis` peer dependency and pass a node-redis client instead of an `ioredis` client
* Added bulk (`loadMany`/`saveMany`) and named record-set (`loadSet`/`saveSet`) operations to the
  `SimpleStore` interface, `MemoryStore` and `RedisStore`
* Added `clear()` and `deleteMany()`/`deleteSet()` to the `SimpleStore` interface, `MemoryStore` and
  `RedisStore`

## v3.0.0

* Added a new `SimpleStore` interface, with `MemoryStore` (in-process) and `RedisStore` (Redis-backed,
  via `ioredis`) implementations, providing a common TTL-based caching/session storage API
* `ObjectFactory` now awaits injected dependencies concurrently instead of sequentially during
  initialization, and `destroy()` skips null/undefined objects
* `ClassLoader` no longer imports non-function/class exports, and fixed a bug in fully-qualified name
  calculation
* `FileUtils` converted to the async `fs/promises` API, and fixed a path-containment check bug in
  `copyFile`
* `ThreadPool` no longer mutates the caller's options, gives new workers a 30s startup grace period,
  and no longer crashes when messaging a dead worker
* `StringUtils.findAndReplace` no longer mutates the caller's variables and is O(n) instead of O(n²)
  `StringUtils.replaceAll` now performs whole-match replacement
* `Logger` and `OASUtils` cache lookups now protect frequently-reused entries from eviction, and
  `Logger`'s cache is bounded to prevent runaway file handle usage
* Fixed a bug where `Logger` wrote ANSI color codes into on-disk log files, and a bug where a failed or
  concurrent `ObjectFactory` initialization could leave a broken/half-initialized instance in place
* `JWTUtils` gained additional validation for `hybridDecrypt` and now checks the encryption algorithm
  for the correct key length
* `MessagingUtils` fixed template compilation, now checks template file existence via `FileUtils`, and
  sends Slack messages to multiple workspaces in parallel
* `NotificationUtils` messages are now namespaced by subscription to prevent channel collisions
  between broadcast and direct messages
* `TelemetryUtils` gained an `off()` function for unregistering listeners, and `Event`'s copy
  constructor uses a safer property-copying approach
* Numerous other bug, vulnerability and performance fixes

## v1.3.0

* Fixed issue in ThreadPool that caused runaway memory usage
* Improved message passing in ThreadPool when sending messages to workers
* Removed synchronize function calls from multiple areas to improve execution performance
* Added caching of class metadata in ObjectFactory to improve traversal performance
* Added pre-compiled regex patterns for improved string search
* Added pre-compiling of handlebars templates
* Added caching of OpenAPI specification data
* Adding cache map to Logger to reduce extra instances from being created for the same level/file.
* Other performance improvements

## v1.2.0

* `ObjectFactory.newInstance` and `ObjectFactory.initialize` now returns synchronously for classes that do not have asynchronous initialization
* Fixed vulnerability with JWTUtils that allowed an attacker to easily decipher encrypted profiles
* Fixed multiple issues with ESM support
* Upgraded all dependencies to latest version

## v1.1.0

* MessagingUtils can now load templates from files

## v1.0.0

* Alert & Notification System
* Class Loader
* File management utilities
* JSON Web Token utilities
* Object Factory
* OpenAPI utilities
* String utilities
* Telemetry utilities
* Thread-pool Manager
* User authentication utilities
* Validation utilities
