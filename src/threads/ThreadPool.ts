///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import { Worker } from "worker_threads";
import os from "os";
import path from "path";
import { WorkerMessage, WorkerMessageType } from "./ThreadWorker.js";
import { sleep } from "../sleep.js";
import { Config, Destroy, Logger } from "../decorators/ObjectDecorators.js";

/**
 * Callback function for `ThreadPool` events.
 *
 * @param threadId The id of the thread that originated the event.
 * @param msg The optional message data associated with the event.
 */
export type WorkerCallback = (threadId: number, msg?: any) => void;

/**
 * Describes the various options that can be used when creating worker threads.
 */
export interface WorkerOptions {
    /** The list of initialization arguments to pass into the worker thread. */
    args?: any;
    /** The path to the entry file create a worker thread from. Default is `ThreadWorkerEntry.js`. */
    entry?: string;
    /** Indicates if a worker thread should automatically be restarted on exit. */
    restartOnExit?: boolean;
    /** Set to `true` to enable support for importing TypeScript modules in the worker. Default is `true`. */
    allowTs?: boolean;
    /** The path to the worker file. This must be set when using `ThreadWorkerEntry` as the default entry file. */
    worker?: string;
}

/**
 * The `ThreadPool` class provides an interface for managing a pool of execution threads that can be used for parallel
 * code execution. `ThreadPool` is a wrapper to the `worker_threads` API to add support for multiple `Worker` instances.
 * By default, the pool will create *n* workers corresponding to the number of CPUs (physical + virtual) on the system.
 *
 * There are two ways to start worker threads with the pool.
 *
 * The first way is to set the `entry` option when calling the `start()` function. This will create a instance of the
 * `worker_threads` APIs `Worker` class with the specified file as the entry point. Note that this file must be of
 * type JavaScript (`.js` extension) as the underlying system does not support loading TypeScript. If the `args` option
 * is set, the value will be passed in as the `workerData` to the entry file.
 *
 * The second way to start a worker thread is by setting the `worker` argument when calling the `start()` function. The
 * specified `worker` file must contain a `default` export. The `default` export must be a class definition which
 * extends the `ThreadWorker` abstract class interface. The file can be either JavaScript or TypeScript. When using
 * this method the `start()` function will return only when all worker instances in each thread of the pool has
 * successfully returned from its `start()` function. When the `args` option is set, the value(s) will be passed in to
 * the constructor on instantiation by the thread executor.
 *
 * When the `restartOnExit` option is specified, the pool will automatically recreate and start a worker thread on
 * the `exit event`.
 *
 * This class exposes worker messages via the `on()` callback handler function. Registering a callback handler via
 * `on()` will propogate all messages from all underlying threads in the pool.
 *
 * @author Jean-Philippe Steinmetz
 */
export class ThreadPool {
    /** The map of event types to a list of callback functions. */
    private callbacks: Map<string, Array<WorkerCallback>>;
    /** The index of the last worker that was assigned work. */
    private lastThread: number;
    /** The instance of Winston logger to forward thread logs to. */
    @Logger
    private logger?: any;
    /** The maximum number of threads allowed. */
    @Config("thread_pool:max_threads", os.cpus().length)
    private maxThreads: number = os.cpus().length;
    /** The list of active worker threads. */
    public readonly workers: Array<Worker>;
    /** Used to indicate that the pool is shutting down. */
    private shutdown: boolean;

    /**
     * The maximum number of threads that can be created by the pool.
     */
    public get max(): number {
        return this.maxThreads;
    }

    /**
     * The number of active threads in the pool.
     */
    public get size(): number {
        return this.workers.length;
    }

    /**
     * Creates a new `ThreadPool` instance with the specified defaults.
     *
     * @param max The maximum number of threads to create. Default is `os.cpus().length`.
     * @param logger The Winston logger instance to forward all worker thread logs to.
     */
    constructor(max: number = 0, logger?: any) {
        this.maxThreads = max || this.maxThreads || os.cpus().length;
        this.lastThread = 0;
        this.logger = logger;
        this.callbacks = new Map();
        this.shutdown = false;
        this.workers = new Array();
    }

    private createWorker(idx: number, options: WorkerOptions): Worker {
        if (!options.entry || !!options.worker) {
            options.entry = path.join(__dirname, "ThreadWorkerEntry.js");
        }
        const workerOptions: any = {
            workerData: options && options.worker ? options : options?.args,
        };
        this.logger?.debug(`Creating thread worker: ${JSON.stringify(options)}`);
        const worker: Worker = new Worker(options.entry, workerOptions);

        worker.on("error", (error) => {
            const listeners: Array<WorkerCallback> | undefined = this.callbacks.get("error");
            if (listeners) {
                for (const callback of listeners) {
                    callback(idx, error);
                }
            }
        });
        worker.on("exit", async (code) => {
            const listeners: Array<WorkerCallback> | undefined = this.callbacks.get("exit");
            if (listeners) {
                for (const callback of listeners) {
                    callback(idx, code);
                }
            }

            // Restart worker thread
            if (options?.restartOnExit && !this.shutdown) {
                const worker: Worker = this.createWorker(idx, options);
                this.workers[idx] = worker;
            }
        });
        worker.on("message", (msg: WorkerMessage) => {
            switch (msg.type) {
                case WorkerMessageType.LOG:
                    this.logger?.log(msg.data);
                    break;
                case WorkerMessageType.ONLINE:
                    {
                        const listeners: Array<WorkerCallback> | undefined = this.callbacks.get("online");
                        if (listeners) {
                            for (const callback of listeners) {
                                callback(idx);
                            }
                        }
                    }
                    break;
                default:
                    {
                        const listeners: Array<WorkerCallback> | undefined = this.callbacks.get("message");
                        if (listeners) {
                            for (const callback of listeners) {
                                callback(idx, msg);
                            }
                        }
                    }
                    break;
            }
        });

        return worker;
    }

    /**
     * Initializes the thread pool with the initial worker threads and begins execution.
     *
     * @param entry The path of the entry create a worker thread from. Default is `ThreadWorkerEntry.js`.
     * @param options The options to use when creating the worker thread.
     * @param num The number of initial threads to create, cannot be greater than max. Default is `max`.
     */
    public start(options?: WorkerOptions, num: number = this.max): Promise<void> {
        this.shutdown = false;

        return new Promise((resolve, reject) => {
            let numReady: number = 0;
            if (!options) {
                options = {};
            }
            options.allowTs = "allowTs" in options ? options.allowTs : true;

            for (let i = 0; i < num && i < this.maxThreads; i++) {
                const worker: Worker = this.createWorker(i, options);
                worker.on("online", () => {
                    if (options && !options.worker) {
                        numReady++;
                    }

                    // When all workers have finished being created resolve
                    if (numReady >= num || numReady >= this.maxThreads) {
                        resolve();
                    }
                });
                worker.on("message", (msg: any) => {
                    switch (msg.type) {
                        case WorkerMessageType.ERROR:
                            reject(msg.data);
                            break;
                        case WorkerMessageType.ONLINE:
                            numReady++;
                            break;
                    }

                    // When all workers have finished being created resolve
                    if (numReady >= num || numReady >= this.maxThreads) {
                        resolve();
                    }
                });
                this.workers[i] = worker;
            }
            this.logger?.debug(`Created ${this.workers.length} worker(s)`)
        });
    }

    /**
     * Stops all running thread executions.
     */
    @Destroy
    public async stop(): Promise<void> {
        const listeners: Array<WorkerCallback> | undefined = this.callbacks.get("exit");
        this.shutdown = true;

        // Send the stop signal so the workers know to terminate
        this.sendAll({ type: WorkerMessageType.STOP });
        // Give the message above a chance to propogate
        await sleep(10);

        for (let idx = 0; idx < this.workers.length; idx++) {
            const worker: Worker = this.workers[idx];
            const exitCode: number = await worker.terminate();

            if (listeners) {
                for (const callback of listeners) {
                    callback(idx, exitCode);
                }
            }
        }
    }

    /**
     * Registers a new callback function to be notified when the given event type is fired.
     *
     * @param type The event type to be notified of. Possible values are: `error`, `exit` and `message`.
     * @param func The callback function to register.
     */
    public on(type: string, func: WorkerCallback): void {
        let listeners: Array<WorkerCallback> | undefined = this.callbacks.get(type);
        if (!listeners) {
            listeners = new Array();
        }
        listeners.push(func);
        this.callbacks.set(type, listeners);
    }

    /**
     * Sends the provided message to the next available worker thread. Messages are sent in a round-robin order.
     * @param msg The message to send the next available worker thread.
     */
    public send(msg: any): void {
        const startIdx: number = (this.lastThread + 1) % this.workers.length;
        let worker: Worker | undefined = undefined;
        do {
            worker = this.workers[startIdx];
            this.lastThread = startIdx;
        } while (!worker);

        worker.postMessage(msg);
    }

    /**
     * Sends the provided message to all worker threads in the pool.
     * @param msg The message to send to all workers.
     */
    public sendAll(msg: any): void {
        for (const worker of this.workers) {
            worker.postMessage(msg);
        }
    }

    /**
     * Sends the provided message to the worker thread with the specified id.
     * @param id The id of the thread to send the message to.
     * @param msg The message to send the next available worker thread.
     */
    public sendTo(id: number, msg: any): void {
        if (this.workers[id]) {
            this.workers[id].postMessage(msg);
        }
    }
}
