# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [5.2.0] - 2026-09-05

### Added
- Added @rapidrest/cli as dev dependency

### Fixed
- Fixed JWTUtils.createToken() rejecting any asymmetric signing secret

### Fixed
- Fixed `JWTUtils.createToken()`/`createTokenSync()` throwing (`"algorithms" is not allowed in "options"`) for any asymmetric secret, since `assertSafeAlgorithm` requires `options.algorithms` to be set in that case but `jsonwebtoken`'s `sign()` rejects that plural, `verify()`-only key outright. The single `algorithm` `sign()` needs is now derived from `algorithms` when not already set explicitly.

## [5.1.0] - 2026-08-22

### Changed
- Switched build image to `node:lts-bookworm-slim`, then to `node:lts-trixie-slim`
- Upgraded dependencies
- Updated package scripts for `test` and `test:prod`

### Fixed
- Fixed GitHub Actions workflows
- Fixed leftover file spam from `Logger.test.ts`

### Removed
- Removed `coveralls` as a dependency

## [5.0.1] - 2026-08-21

### Fixed
- Fixed license section in the README

## [5.0.0] - 2026-08-21

### Changed
- Switched project license to Mozilla Public License v2.0 (MPL-2.0)
- Updated copyright notices to include MPL

## [4.1.0] - 2026-08-21

### Added
- Added TTL check/sweep to stored sets
- Added max size enforcement to sets

### Changed
- `RedisCache` now URI-encodes IDs to prevent delimiter spoofing/conflicts

### Fixed
- Fixed issue in `loadMany` that didn't free up enough space during sweep

## [4.0.1] - 2026-08-19

### Fixed
- Fixed default `RedisStore` base key

### Changed
- Converted `redis` import to a type-only import

## [4.0.0] - 2026-08-19

### Changed
- Refactored from `ioredis` to `node-redis` (preferred library)

### Added
- Added several new functions to the `SimpleStore` interface supporting clearing, and load/store of multiple records and sets of records

## [3.1.0] - 2026-08-18

### Changed
- `ObjectFactory` now sets a reference to itself on each constructed object

## [3.0.2] - 2026-08-18

### Removed
- Removed templating from `SimpleStore`

## [3.0.1] - 2026-08-18

### Added
- Added missing exports

## [3.0.0] - 2026-08-18

### Added
- Added `off()` function to `TelemetryUtils` for unregistering listeners
- Added subscription namespace to `NotificationUtils`
- Exposed `FileUtils.exists()` as a public method
- Added new `SimpleStore` interface
- Added new `RedisStore` implementation of `SimpleStore` (hybrid in-memory/Redis store)

### Changed
- Consolidated calling dispatch handlers in `ThreadPool`
- `ObjectFactory.destroy()` now skips null/undefined objects
- `ClassLoader` now ignores non-function/class exports
- Improved error handling in `JWTUtils`
- `MessagingUtils.sendSlack` now executes in parallel
- Optimized `StringUtils.findAndReplace` from O(n²) to O(n)
- Converted `FileUtils` to use the `fs.promises` API instead of sync APIs
- Converted `ObjectFactory` `init()` handling to concurrent promise awaits
- `ThreadPool` now gives workers a 30s grace period on startup so they cannot hang forever
- Event copy constructor now uses `Object.keys()` with an updated denylist for safer copying
- `Logger` now uses a bounded cache (100 entries) to prevent runaway file writes
- `FileUtils` now coerces an empty/null set for variables
- `StringUtils.findAndReplace` no longer mutates passed-in arguments
- `OASUtils` now uses `fs/promises` instead of sync operations
- `JWTUtils` adds more validation checks for `hybridDecrypt`
- `JWTUtils` now checks the encryption algorithm for correct key length
- `StringUtils.replaceAll` now performs whole-match replacement
- `ThreadPool` no longer mutates the caller's options
- `OASUtils.loadSpec` now returns a structured clone so mutations don't corrupt the cache
- `MessagingUtils` now uses `FileUtils` to check template file existence
- `Logger`/`OASUtils` cache now re-orders entries so frequent hits stay cached longer
- `MemoryStore` now implements the `SimpleStore` interface

### Fixed
- Fixed several bugs, vulnerabilities, and performance issues
- Fixed containment check in `FileUtils.copyFile`
- Fixed `StringUtils.findAndReplace` inserting an empty string when a variable is null/undefined
- Fixed unhandled promise rejection in `ThreadPool` worker
- Fixed template compilation issue in `MessagingUtils`
- Fixed `fqn` calculation in `ClassLoader`
- Fixed issues with dead workers causing crashes in `ThreadPool`
- Fixed path issue in `OASUtils`
- Fixed eviction policy issue in `MemoryStore`
- Fixed logger issue that corrupted on-disk logs when using `colorize()`
- Fixed object initialization issue that could produce half-initialized or failed object instances

## [1.15.0] - 2026-08-11

### Changed
- `NotificationUtils` now uses an injected logger

### Fixed
- Fixed `JWTUtils` algorithm-confusion bypass (`KeyObject`/`{key,passphrase}`)
- Fixed `ObjectUtils` null-property recursion crash
- Fixed `JWTUtils` RSA payload size limit and compress/encrypt ordering
- Fixed `FileUtils` `copyBinaryFile`/`copyFile` directory and empty-file bugs
- Fixed `ObjectFactory` async `@Inject` not being awaited
- Fixed `ObjectFactory` `getInstance(null)` returning the wrong error
- Fixed `ThreadPool` `start()` worker leak and hang on error/zero threads
- Fixed `ThreadPool` `stop()` sequential termination
- Fixed `StringUtils` `findAndReplace` `$`-sequence corruption
- Fixed `AlertUtils` logger crash, polling backoff, and URL encoding
- Fixed `OASUtils` `getObject` crash, `getSchema` substring match, and cache bound
- Fixed `NotificationUtils` unhandled publish rejections
- Fixed `ValidationUtils` `checkVersion` NaN and `checkNull` rejecting 0
- Fixed missing `NotificationUtils` export in `index.ts`
- Fixed `UserUtils` `hasRole` `orgUid` check
- Fixed `Logger` scoped stack trace limit instead of a global mutation
- Fixed `JWTUtils` password encryption AEAD auth tag handling
- Fixed `ThreadPool` worker leak/crash-loop on init failure
- Fixed `AlertUtils` multipart boundary header
- Fixed `StringUtils` falsy value truthiness check
- Fixed `ObjectFactory` `getInitMethods` break bug
- Fixed `ClassLoader` symlink containment bypass
- Fixed `ObjectFactory.destroy()` losing track of instances
- Fixed `ThreadPool` `stop()` not giving workers enough time to clean up
- Fixed stack overflow issue in `ObjectUtils` when traversing circular object graphs
- Fixed `MessagingUtils` template loading when multiple instances exist
- Fixed `FileUtils` not respecting overwrite protection
- Fixed `NotificationUtils` crash when Redis throws synchronously

## [1.14.0] - 2026-08-10

### Changed
- Switched `elevated` from boolean to number to indicate the timestamp when elevated privileges were granted

## [1.13.0] - 2026-08-10

### Added
- Added `elevated` flag to the `JWTUser` interface

## [1.12.0] - 2026-08-05

### Added
- Added missing package for CI test job
- Added actions/coveralls/tags badges to README

### Changed
- Updated CI GitHub Actions to v6
- Swapped to NPM badge instead of release badge
- `Logger` now includes the source class name and method

### Fixed
- Fixed test
- Fixed test CI job
- Fixed badge URLs

## [1.11.0] - 2026-07-21

### Removed
- Removed async function signatures from `MemoryStore`

## [1.10.0] - 2026-07-21

### Added
- Added new `MemoryStore`

### Fixed
- Fixed multiple high severity bugs

## [1.9.0] - 2026-07-18

### Changed
- Switched `isDate` to use `parse` for date validation

## [1.8.0] - 2026-07-16

### Removed
- Removed `name` from `JWTUtils`

## [1.7.0] - 2026-07-15

### Added
- Added new `@RequiresScope` decorator
- Added new `deleteScopedProps` function to `ObjectUtils` to remove props decorated with `@RequiresScope`

## [1.6.0] - 2026-07-15

### Fixed
- Fixed a bug in `JWTUtils` that caused tokens to not be decoded correctly
- Fixed multiple issues in `AlertUtils`
- Fixed Twilio initialization in `MessagingUtils`

## [1.5.0] - 2026-07-15

### Added
- Added `scopes` property to `JWTUser` interface for handling OAuth-style permissions

## [1.4.0] - 2026-07-11

### Fixed
- Fixed several bugs and issues following a vulnerability audit

## [1.3.2] - 2026-07-08

### Removed
- Removed docs and docs generation (superseded by the rapidrest.dev repo)

### Fixed
- Fixed `StringUtils` documentation issue incompatible with typedoc/docusaurus

## [1.3.1] - 2026-06-30

### Fixed
- Fixed issue with `ClassLoader` that broke imports on Windows

## [1.3.0] - 2026-06-12

### Changed
- Set minimum Node.js version to v24
- Swapped Node.js Docker image
- Performance improvements

## [1.2.0] - 2026-06-11

### Fixed
- Fixed two identified vulnerabilities with JWT token encryption
- Fixed linter error; linter now runs on build
- Fixed issues with docs/comments

## [1.1.4] - 2026-06-09

### Changed
- Upgraded all dependencies

## [1.1.3] - 2026-06-09

### Fixed
- Fixed lint error
- Fixed another linter error

## [1.1.2] - 2026-06-09

### Added
- Added missing catch statement

### Fixed
- Fixed ESM conversion issues

## [1.1.1] - 2026-03-05

### Changed
- `ObjectFactory` now always returns immediately if a class doesn't have async initialization

### Fixed
- Fixed npm publish command

## [1.1.0] - 2026-03-05

### Added
- Added support for loading message templates from files

### Removed
- Removed unused configuration
- Removed generated docs files

## [1.0.2] - 2026-02-03

### Changed
- Configured publish workflow for an environment
- Converted README/release notes to Markdown

### Removed
- Removed all `require` imports

## [1.0.1] - 2026-02-03

### Added
- Added `docs` directory to the NPM package

## [1.0.0] - 2026-02-03

### Added
- Initial release

[Unreleased]: https://github.com/rapidrest/core/compare/v5.2.0...HEAD
[5.2.0]: https://github.com/rapidrest/core/compare/v5.1.0...v5.2.0
[5.1.0]: https://github.com/rapidrest/core/compare/v5.0.1...v5.1.0
[5.0.1]: https://github.com/rapidrest/core/compare/v5.0.0...v5.0.1
[5.0.0]: https://github.com/rapidrest/core/compare/v4.1.0...v5.0.0
[4.1.0]: https://github.com/rapidrest/core/compare/v4.0.1...v4.1.0
[4.0.1]: https://github.com/rapidrest/core/compare/v4.0.0...v4.0.1
[4.0.0]: https://github.com/rapidrest/core/compare/v3.1.0...v4.0.0
[3.1.0]: https://github.com/rapidrest/core/compare/v3.0.2...v3.1.0
[3.0.2]: https://github.com/rapidrest/core/compare/v3.0.1...v3.0.2
[3.0.1]: https://github.com/rapidrest/core/compare/v3.0.0...v3.0.1
[3.0.0]: https://github.com/rapidrest/core/compare/v1.15.0...v3.0.0
[1.15.0]: https://github.com/rapidrest/core/compare/v1.14.0...v1.15.0
[1.14.0]: https://github.com/rapidrest/core/compare/v1.13.0...v1.14.0
[1.13.0]: https://github.com/rapidrest/core/compare/v1.12.0...v1.13.0
[1.12.0]: https://github.com/rapidrest/core/compare/v1.11.0...v1.12.0
[1.11.0]: https://github.com/rapidrest/core/compare/v1.10.0...v1.11.0
[1.10.0]: https://github.com/rapidrest/core/compare/v1.9.0...v1.10.0
[1.9.0]: https://github.com/rapidrest/core/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/rapidrest/core/compare/v1.7.0...v1.8.0
[1.7.0]: https://github.com/rapidrest/core/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/rapidrest/core/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/rapidrest/core/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/rapidrest/core/compare/v1.3.2...v1.4.0
[1.3.2]: https://github.com/rapidrest/core/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/rapidrest/core/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/rapidrest/core/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/rapidrest/core/compare/v1.1.4...v1.2.0
[1.1.4]: https://github.com/rapidrest/core/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/rapidrest/core/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/rapidrest/core/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/rapidrest/core/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/rapidrest/core/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/rapidrest/core/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/rapidrest/core/compare/a2170df9e717a3683eb8f080c12916c52554c2eb...v1.0.1
[1.0.0]: https://github.com/rapidrest/core/commit/a2170df9e717a3683eb8f080c12916c52554c2eb
