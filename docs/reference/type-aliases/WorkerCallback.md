[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / WorkerCallback

# Type Alias: WorkerCallback()

> **WorkerCallback** = (`threadId`, `msg?`) => `void`

Defined in: src/threads/ThreadPool.ts:17

Callback function for `ThreadPool` events.

## Parameters

### threadId

`number`

The id of the thread that originated the event.

### msg?

`any`

The optional message data associated with the event.

## Returns

`void`
