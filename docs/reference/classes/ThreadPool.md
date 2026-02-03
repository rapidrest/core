[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / ThreadPool

# Class: ThreadPool

Defined in: src/threads/ThreadPool.ts:62

The `ThreadPool` class provides an interface for managing a pool of execution threads that can be used for parallel
code execution. `ThreadPool` is a wrapper to the `worker_threads` API to add support for multiple `Worker` instances.
By default, the pool will create *n* workers corresponding to the number of CPUs (physical + virtual) on the system.

There are two ways to start worker threads with the pool.

The first way is to set the `entry` option when calling the `start()` function. This will create a instance of the
`worker_threads` APIs `Worker` class with the specified file as the entry point. Note that this file must be of
type JavaScript (`.js` extension) as the underlying system does not support loading TypeScript. If the `args` option
is set, the value will be passed in as the `workerData` to the entry file.

The second way to start a worker thread is by setting the `worker` argument when calling the `start()` function. The
specified `worker` file must contain a `default` export. The `default` export must be a class definition which
extends the `ThreadWorker` abstract class interface. The file can be either JavaScript or TypeScript. When using
this method the `start()` function will return only when all worker instances in each thread of the pool has
successfully returned from its `start()` function. When the `args` option is set, the value(s) will be passed in to
the constructor on instantiation by the thread executor.

When the `restartOnExit` option is specified, the pool will automatically recreate and start a worker thread on
the `exit event`.

This class exposes worker messages via the `on()` callback handler function. Registering a callback handler via
`on()` will propogate all messages from all underlying threads in the pool.

## Author

Jean-Philippe Steinmetz

## Constructors

### Constructor

> **new ThreadPool**(`max`, `logger?`): `ThreadPool`

Defined in: src/threads/ThreadPool.ts:98

Creates a new `ThreadPool` instance with the specified defaults.

#### Parameters

##### max

`number` = `0`

The maximum number of threads to create. Default is `os.cpus().length`.

##### logger?

`any`

The Winston logger instance to forward all worker thread logs to.

#### Returns

`ThreadPool`

## Properties

### workers

> `readonly` **workers**: `Worker`[]

Defined in: src/threads/ThreadPool.ts:74

The list of active worker threads.

## Accessors

### max

#### Get Signature

> **get** **max**(): `number`

Defined in: src/threads/ThreadPool.ts:81

The maximum number of threads that can be created by the pool.

##### Returns

`number`

***

### size

#### Get Signature

> **get** **size**(): `number`

Defined in: src/threads/ThreadPool.ts:88

The number of active threads in the pool.

##### Returns

`number`

## Methods

### on()

> **on**(`type`, `func`): `void`

Defined in: src/threads/ThreadPool.ts:251

Registers a new callback function to be notified when the given event type is fired.

#### Parameters

##### type

`string`

The event type to be notified of. Possible values are: `error`, `exit` and `message`.

##### func

[`WorkerCallback`](../type-aliases/WorkerCallback.md)

The callback function to register.

#### Returns

`void`

***

### send()

> **send**(`msg`): `void`

Defined in: src/threads/ThreadPool.ts:264

Sends the provided message to the next available worker thread. Messages are sent in a round-robin order.

#### Parameters

##### msg

`any`

The message to send the next available worker thread.

#### Returns

`void`

***

### sendAll()

> **sendAll**(`msg`): `void`

Defined in: src/threads/ThreadPool.ts:279

Sends the provided message to all worker threads in the pool.

#### Parameters

##### msg

`any`

The message to send to all workers.

#### Returns

`void`

***

### sendTo()

> **sendTo**(`id`, `msg`): `void`

Defined in: src/threads/ThreadPool.ts:290

Sends the provided message to the worker thread with the specified id.

#### Parameters

##### id

`number`

The id of the thread to send the message to.

##### msg

`any`

The message to send the next available worker thread.

#### Returns

`void`

***

### start()

> **start**(`options?`, `num?`): `Promise`\<`void`\>

Defined in: src/threads/ThreadPool.ts:177

Initializes the thread pool with the initial worker threads and begins execution.

#### Parameters

##### options?

[`WorkerOptions`](../interfaces/WorkerOptions.md)

The options to use when creating the worker thread.

##### num?

`number` = `...`

The number of initial threads to create, cannot be greater than max. Default is `max`.

#### Returns

`Promise`\<`void`\>

***

### stop()

> **stop**(): `Promise`\<`void`\>

Defined in: src/threads/ThreadPool.ts:224

Stops all running thread executions.

#### Returns

`Promise`\<`void`\>
