[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / ThreadWorker

# Abstract Class: ThreadWorker

Defined in: src/threads/ThreadWorker.ts:29

Provides a simple abstract interface for creating thread workers when using the `ThreadPool` system.

## Author

Jean-Philippe Steinmetz

## Constructors

### Constructor

> **new ThreadWorker**(`logger`): `ThreadWorker`

Defined in: src/threads/ThreadWorker.ts:32

#### Parameters

##### logger

`any`

#### Returns

`ThreadWorker`

## Properties

### logger

> `protected` **logger**: `any`

Defined in: src/threads/ThreadWorker.ts:30

## Methods

### onMessage()

> `abstract` **onMessage**(`msg`): `void` \| `Promise`\<`void`\>

Defined in: src/threads/ThreadWorker.ts:41

Callback function when a message is received from the thread pool manager.

#### Parameters

##### msg

[`WorkerMessage`](../interfaces/WorkerMessage.md)

The message that was received.

#### Returns

`void` \| `Promise`\<`void`\>

***

### start()

> `abstract` **start**(): `void` \| `Promise`\<`void`\>

Defined in: src/threads/ThreadWorker.ts:46

Starts execution of the thread worker.

#### Returns

`void` \| `Promise`\<`void`\>

***

### stop()

> `abstract` **stop**(): `void` \| `Promise`\<`void`\>

Defined in: src/threads/ThreadWorker.ts:51

Stops execution of all work and shuts down the thread worker.

#### Returns

`void` \| `Promise`\<`void`\>
