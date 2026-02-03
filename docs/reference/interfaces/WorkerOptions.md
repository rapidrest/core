[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / WorkerOptions

# Interface: WorkerOptions

Defined in: src/threads/ThreadPool.ts:22

Describes the various options that can be used when creating worker threads.

## Properties

### allowTs?

> `optional` **allowTs**: `boolean`

Defined in: src/threads/ThreadPool.ts:30

Set to `true` to enable support for importing TypeScript modules in the worker. Default is `true`.

***

### args?

> `optional` **args**: `any`

Defined in: src/threads/ThreadPool.ts:24

The list of initialization arguments to pass into the worker thread.

***

### entry?

> `optional` **entry**: `string`

Defined in: src/threads/ThreadPool.ts:26

The path to the entry file create a worker thread from. Default is `ThreadWorkerEntry.js`.

***

### restartOnExit?

> `optional` **restartOnExit**: `boolean`

Defined in: src/threads/ThreadPool.ts:28

Indicates if a worker thread should automatically be restarted on exit.

***

### worker?

> `optional` **worker**: `string`

Defined in: src/threads/ThreadPool.ts:32

The path to the worker file. This must be set when using `ThreadWorkerEntry` as the default entry file.
