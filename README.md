# RapidREST: Core Library

[![CI](https://github.com/rapidrest/core/actions/workflows/build.yml/badge.svg?branch=main)](https://github.com/rapidrest/core/actions/workflows/build.yml)
[![Coverage Status](https://coveralls.io/repos/github/rapidrest/core/badge.svg?branch=main)](https://coveralls.io/github/rapidrest/core?branch=main)
[![npm version](https://img.shields.io/npm/v/@rapidrest/core)](https://www.npmjs.com/package/@rapidrest/core)

A shared utility library consumed by RapidREST-based applications and servers, including
[`@rapidrest/service-core`](https://www.npmjs.com/package/@rapidrest/service-core). It provides the
foundational building blocks — dependency injection, caching, messaging, logging, token-based auth
and more — that the rest of the RapidREST ecosystem is built on.

For complete documentation please visit [RapidREST.dev](https://rapidrest.dev).

## Features

**Object Lifecycle & Dependency Injection**

- `ClassLoader` — dynamically discovers and loads classes at runtime from a folder structure, using
  C#/Java-style namespace conventions
- `ObjectFactory` — a lightweight DI container that creates and tracks classes and instances
- Easily inject class dependencies via `@Inject`, `@Config`, `@Logger`
- Control object lifecycle via `@Init`, `@Destroy`

**Caching & Session Storage**

- A common `SimpleStore` interface for TTL-based record storage, with `MemoryStore` (in-process) and
  `RedisStore` (Redis-backed, for sharing state across multiple app instances) implementations
- Bulk (`loadMany`/`saveMany`) and named record-set (`loadSet`/`saveSet`) operations

**Auth & Validation**

- `JWTUtils` — create, sign, verify and decode JSON Web Tokens, with optional password- or key-based
  payload encryption and compression
- `UserUtils` — role, scope and organization-membership checks against authenticated user objects
- `ValidationUtils` — a library of common field validators (email, URL, phone, UUID, semantic
  version, IP address, date, JSON, etc.) for use with the `@Validator` decorator

**Messaging & Alerting**

- `MessagingUtils` — send templated (Handlebars) messages over e-mail, SMS (Twilio or Telnyx), WhatsApp
  or Slack from a shared template store
- `AlertUtils` — send priority-based (P1–P5) incident alerts, with file attachments, to an external
  alerting/on-call service
- `NotificationUtils` — publish real-time push notifications over Redis pub/sub, to a single user's
  channel or broadcast to every subscriber

**Observability**

- `Logger` — a pre-configured, cached Winston logger that automatically tags log lines with the
  calling class/method name
- `TelemetryUtils` — record application telemetry events and forward them to a configured collection
  service

**General Utilities**

- `StringUtils` — template variable substitution and other string helpers
- `ObjectUtils` — deep property get/set, scoped-property scrubbing, and schema-driven object
  validation
- `FileUtils` — file/directory existence checks, copying and reads, with optional root-directory
  containment
- `OASUtils` — load, cache and query OpenAPI (Swagger) specifications from a local file or URL (JSON
  or YAML), with opt-in path/host allow-listing
- `CacheUtils` — shared helpers for bounded, eviction-on-insert `Map`-based caches
- `ApiError` — an HTTP-aware `Error` subclass carrying an error code, HTTP status, and templated
  messages

**Concurrency**

- `ThreadPool` — manage a pool of Node.js worker threads (auto-sized to the number of CPUs by
  default), with typed message passing and automatic restart on worker crash

## Getting Started

### Yarn

```
yarn add @rapidrest/core
```

### NPM

```
npm i @rapidrest/core
```

## Requirements

This package targets Node.js `>=24.0.0` and is published as an ESM-only package.

The following peer dependencies are required:

| Peer dependency     | Required for                        |
| ------------------- | ------------------------------------ |
| `axios`             | Always                              |
| `redis`             | Caching & sessions via `RedisStore` |
| `reflect-metadata`  | Always                              |
| `winston`           | Always                              |
| `winston-transport` | Always                              |

`MessagingUtils` dynamically imports the following packages at runtime, so they are not declared as
dependencies — only install the ones for the channel(s) you actually use:

| Package       | Required for                |
| ------------- | --------------------------- |
| `nodemailer`  | E-mail messaging            |
| `twilio`      | SMS messaging via Twilio    |
| `@slack/bolt` | Slack messaging             |

SMS can be delivered through either Twilio or Telnyx. Choose one with `sms_config.provider` and put that
provider's settings in `sms_config.config`. Telnyx needs no extra package (it uses `axios`). Both providers
send from `templates.from.sms` and take the recipient from `options.to`:

```yaml
sms_config:
  provider: telnyx # or "twilio"
  config:
    apiKey: KEY_xxx
    messagingProfileId: 16fd2706-... # optional
```

```yaml
sms_config:
  provider: twilio
  config:
    accountSid: AC...
    token: xxx
    options: {} # optional, passed to the Twilio client
```

WhatsApp is sent separately with `sendWhatsApp()`, through Meta's WhatsApp Business Cloud API (again via
`axios`, no extra package). It sends from the configured phone number and takes the recipient from
`options.to`:

```yaml
whatsapp:
  accessToken: EAAG... # Meta system user token
  phoneNumberId: "1055..." # Meta's ID for your WhatsApp Business number (not the number itself)
  apiVersion: v23.0 # optional
templates:
  login:
    enabled: true
    whatsapp: "Your code is {{code}}" # free-form text
    whatsapp_template: # approved template; used instead of `whatsapp` when set
      name: login_code
      language: en_US
      parameters: ["{{code}}"] # fills the template's {{1}}, {{2}}, ... in order
```

WhatsApp only delivers free-form text within 24 hours of the recipient's last message to you. To message
anyone else, define `whatsapp_template` with a template approved in Meta's WhatsApp Manager.

## License

MPL v2.0 — see [LICENSE](./LICENSE).
