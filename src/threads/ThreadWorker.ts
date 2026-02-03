///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
/**
 * Describes the types of messages passed between the parent thread pool manager and a worker thread.
 */
export enum WorkerMessageType {
    ERROR = "_WorkerError",
    LOG = "_WorkerLog",
    ONLINE = "_WorkerOnline",
    STOP = "_StopWorker",
}

/**
 * Describes a single message sent from the thread pool managger to a worker thread.
 */
export interface WorkerMessage {
    /** The data associated with the message. */
    data?: any;
    /** The type of message sent. */
    type: WorkerMessageType;
}

/**
 * Provides a simple abstract interface for creating thread workers when using the `ThreadPool` system.
 *
 * @author Jean-Philippe Steinmetz
 */
export abstract class ThreadWorker {
    protected logger: any;

    constructor(logger: any) {
        this.logger = logger;
    }

    /**
     * Callback function when a message is received from the thread pool manager.
     *
     * @param msg The message that was received.
     */
    public abstract onMessage(msg: WorkerMessage): void | Promise<void>;

    /**
     * Starts execution of the thread worker.
     */
    public abstract start(): void | Promise<void>;

    /**
     * Stops execution of all work and shuts down the thread worker.
     */
    public abstract stop(): void | Promise<void>;
}
