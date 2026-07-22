///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
// Unit-level tests for ThreadPool that mock out `worker_threads` entirely. The real-thread integration test in
// ThreadPool.test.ts is kept (but skipped, see that file for why) as a reference for real-world usage; spinning up
// actual OS threads is slow and, on Windows, hits a separate ESM loader bug (ERR_UNSUPPORTED_ESM_URL_SCHEME)
// unrelated to ThreadPool's own logic. Mocking `Worker` lets us deterministically drive every event/branch here.
import { EventEmitter } from "events";
import os from "os";
import { describe, it, expect, vi, beforeEach } from "vitest";

let createdWorkers: MockWorker[] = [];

class MockWorker extends EventEmitter {
    public messages: any[] = [];
    public terminate = vi.fn(async () => 0);
    public entry: string;
    public options: any;
    constructor(entry: string, options: any) {
        super();
        this.entry = entry;
        this.options = options;
        createdWorkers.push(this);
    }
    postMessage(msg: any) {
        this.messages.push(msg);
    }
}

vi.mock("worker_threads", () => ({
    Worker: MockWorker,
}));

const { ThreadPool } = await import("../src/threads/ThreadPool.js");
const { WorkerMessageType } = await import("../src/threads/ThreadWorker.js");

beforeEach(() => {
    createdWorkers = [];
});

function makeLogger() {
    return { debug: vi.fn(), log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() };
}

describe("ThreadPool Unit Tests.", () => {
    it("Defaults max threads to the CPU count.", () => {
        const pool = new ThreadPool();
        expect(pool.max).toBe(os.cpus().length);
        expect(pool.size).toBe(0);
    });

    it("Uses the provided max thread count and logger.", () => {
        const logger = makeLogger();
        const pool = new ThreadPool(3, logger);
        expect(pool.max).toBe(3);
    });

    it("Defaults options to an empty object when start() is called with none.", async () => {
        const pool = new ThreadPool(1);
        const promise = pool.start();
        expect(createdWorkers).toHaveLength(1);
        createdWorkers[0].emit("online");
        await promise;
        expect(pool.size).toBe(1);
    });

    it("Resolves start() once entry-style workers come online.", async () => {
        const pool = new ThreadPool(2);
        const promise = pool.start({ entry: "./worker.js" }, 2);
        expect(createdWorkers).toHaveLength(2);
        createdWorkers.forEach((w) => w.emit("online"));
        await promise;
        expect(pool.size).toBe(2);
    });

    it("Resolves start() for worker-style pools via ONLINE messages, not the native online event.", async () => {
        const pool = new ThreadPool(1);
        const promise = pool.start({ worker: "./MyWorker.js" }, 1);
        expect(createdWorkers).toHaveLength(1);
        // The native "online" event should NOT satisfy readiness when options.worker is set.
        createdWorkers[0].emit("online");
        // Give the (non-existent) resolution a tick to prove it hasn't resolved yet.
        let resolved = false;
        void promise.then(() => (resolved = true));
        await Promise.resolve();
        expect(resolved).toBe(false);

        createdWorkers[0].emit("message", { type: WorkerMessageType.ONLINE });
        await promise;
    });

    it("Rejects start() when a worker sends an ERROR message.", async () => {
        const pool = new ThreadPool(1);
        const promise = pool.start({ worker: "./MyWorker.js" }, 1);
        createdWorkers[0].emit("message", { type: WorkerMessageType.ERROR, data: new Error("boom") });
        await expect(promise).rejects.toThrow("boom");
    });

    it("Forwards LOG messages to the logger.", async () => {
        const logger = makeLogger();
        const pool = new ThreadPool(1, logger);
        const promise = pool.start({ entry: "./worker.js" }, 1);
        createdWorkers[0].emit("online");
        await promise;

        createdWorkers[0].emit("message", { type: WorkerMessageType.LOG, data: "hello from worker" });
        expect(logger.log).toHaveBeenCalledWith("hello from worker");
    });

    it("Notifies registered 'online' callbacks with the thread id.", async () => {
        const pool = new ThreadPool(1);
        const onlineIds: number[] = [];
        pool.on("online", (id: number) => onlineIds.push(id));

        const promise = pool.start({ worker: "./MyWorker.js" }, 1);
        createdWorkers[0].emit("message", { type: WorkerMessageType.ONLINE });
        await promise;

        expect(onlineIds).toEqual([0]);
    });

    it("Notifies registered 'message' callbacks for unrecognized message types.", async () => {
        const pool = new ThreadPool(1);
        const promise = pool.start({ entry: "./worker.js" }, 1);
        createdWorkers[0].emit("online");
        await promise;

        const received: any[] = [];
        pool.on("message", (id: number, msg: any) => received.push([id, msg]));
        createdWorkers[0].emit("message", { type: "CustomType", data: 42 });
        expect(received).toEqual([[0, { type: "CustomType", data: 42 }]]);
    });

    it("Notifies registered 'error' callbacks.", async () => {
        const pool = new ThreadPool(1);
        const promise = pool.start({ entry: "./worker.js" }, 1);
        createdWorkers[0].emit("online");
        await promise;

        const errors: any[] = [];
        pool.on("error", (id: number, err: any) => errors.push([id, err]));
        const err = new Error("worker crashed");
        createdWorkers[0].emit("error", err);
        expect(errors).toEqual([[0, err]]);
    });

    it("Notifies registered 'exit' callbacks and does not restart by default.", async () => {
        const pool = new ThreadPool(1);
        const promise = pool.start({ entry: "./worker.js" }, 1);
        createdWorkers[0].emit("online");
        await promise;

        const exits: any[] = [];
        pool.on("exit", (id: number, code: number) => exits.push([id, code]));
        createdWorkers[0].emit("exit", 1);

        expect(exits).toEqual([[0, 1]]);
        expect(createdWorkers).toHaveLength(1);
    });

    it("Respects an explicitly provided allowTs option.", async () => {
        const pool = new ThreadPool(1);
        const promise = pool.start({ entry: "./worker.js", allowTs: false }, 1);
        expect(createdWorkers[0].options.execArgv).toEqual([]);
        createdWorkers[0].emit("online");
        await promise;
    });

    it("Does not throw when an error event fires with no registered listeners.", async () => {
        const pool = new ThreadPool(1);
        const promise = pool.start({ entry: "./worker.js" }, 1);
        createdWorkers[0].emit("online");
        await promise;

        expect(() => createdWorkers[0].emit("error", new Error("boom"))).not.toThrow();
    });

    it("Recreates the worker on exit when restartOnExit is set.", async () => {
        const pool = new ThreadPool(1);
        const promise = pool.start({ entry: "./worker.js", restartOnExit: true }, 1);
        createdWorkers[0].emit("online");
        await promise;

        createdWorkers[0].emit("exit", 0);

        expect(createdWorkers).toHaveLength(2);
        expect(pool.workers[0]).toBe(createdWorkers[1]);
    });

    it("Does not restart on exit once the pool has been stopped.", async () => {
        const pool = new ThreadPool(1);
        const promise = pool.start({ entry: "./worker.js", restartOnExit: true }, 1);
        createdWorkers[0].emit("online");
        await promise;

        const stopPromise = pool.stop();
        createdWorkers[0].emit("exit", 0);
        await stopPromise;

        expect(createdWorkers).toHaveLength(1);
    });

    it("stop() sends STOP to all workers, waits, then terminates each and fires exit callbacks.", async () => {
        const pool = new ThreadPool(2);
        const promise = pool.start({ entry: "./worker.js" }, 2);
        createdWorkers.forEach((w) => w.emit("online"));
        await promise;

        createdWorkers[0].terminate = vi.fn(async () => 0);
        createdWorkers[1].terminate = vi.fn(async () => 7);

        const exits: any[] = [];
        pool.on("exit", (id: number, code: number) => exits.push([id, code]));

        await pool.stop();

        for (const worker of createdWorkers) {
            expect(worker.messages).toContainEqual({ type: WorkerMessageType.STOP });
            expect(worker.terminate).toHaveBeenCalled();
        }
        expect(exits).toEqual(
            expect.arrayContaining([
                [0, 0],
                [1, 7],
            ]),
        );
    });

    it("stop() does not double-fire 'exit' callbacks when terminate() itself emits the real 'exit' event.", async () => {
        // Real `worker_threads.Worker#terminate()` resolves precisely because the worker's own 'exit' event fires;
        // the mock above doesn't reproduce that by default, so this test wires it up explicitly to exercise the
        // interaction between the "exit" listener registered in createWorker and stop()'s own callback loop.
        const pool = new ThreadPool(1);
        const promise = pool.start({ entry: "./worker.js" }, 1);
        createdWorkers[0].emit("online");
        await promise;

        createdWorkers[0].terminate = vi.fn(async () => {
            createdWorkers[0].emit("exit", 0);
            return 0;
        });

        const exits: any[] = [];
        pool.on("exit", (id: number, code: number) => exits.push([id, code]));

        await pool.stop();

        expect(exits).toEqual([[0, 0]]);
    });

    it("stop() clears the workers array so a stale/terminated worker can't be routed to afterward.", async () => {
        const pool = new ThreadPool(2);
        const promise = pool.start({ entry: "./worker.js" }, 2);
        createdWorkers.forEach((w) => w.emit("online"));
        await promise;

        await pool.stop();

        expect(pool.size).toBe(0);
        expect(pool.workers).toHaveLength(0);
    });

    it("on() supports multiple callbacks for the same event type.", async () => {
        // The native "online" event only drives readiness for entry-style pools (see the dedicated test above);
        // the "online" callback list is only invoked via the worker-style ONLINE message, so that's what's used
        // here to exercise multiple registered callbacks for the same event type.
        const pool = new ThreadPool(1);
        const calls: string[] = [];
        pool.on("online", () => calls.push("first"));
        pool.on("online", () => calls.push("second"));

        const promise = pool.start({ worker: "./MyWorker.js" }, 1);
        createdWorkers[0].emit("message", { type: WorkerMessageType.ONLINE });
        await promise;

        expect(calls).toEqual(["first", "second"]);
    });

    describe("send()", () => {
        it("Throws when there are no workers in the pool.", () => {
            const pool = new ThreadPool(1);
            expect(() => pool.send({ hello: "world" })).toThrow("No workers in pool.");
        });

        it("Sends to the next worker in round-robin order.", async () => {
            const pool = new ThreadPool(3);
            const promise = pool.start({ entry: "./worker.js" }, 3);
            createdWorkers.forEach((w) => w.emit("online"));
            await promise;

            pool.send({ n: 1 });
            pool.send({ n: 2 });
            pool.send({ n: 3 });
            pool.send({ n: 4 });

            // lastThread starts at 0, so the first send goes to (0+1)%3 = 1, then 2, then 0, then 1 again.
            expect(createdWorkers[1].messages).toEqual([{ n: 1 }, { n: 4 }]);
            expect(createdWorkers[2].messages).toEqual([{ n: 2 }]);
            expect(createdWorkers[0].messages).toEqual([{ n: 3 }]);
        });

        it("Skips missing workers and throws if none are available.", async () => {
            const pool = new ThreadPool(2);
            const promise = pool.start({ entry: "./worker.js" }, 2);
            createdWorkers.forEach((w) => w.emit("online"));
            await promise;

            // Simulate a worker slot that has been cleared without shrinking the array.
            (pool.workers as any)[1] = undefined;
            pool.send({ n: 1 });
            expect(createdWorkers[0].messages).toEqual([{ n: 1 }]);

            (pool.workers as any)[0] = undefined;
            expect(() => pool.send({ n: 2 })).toThrow("No available workers in the pool.");
        });
    });

    it("sendAll() posts the message to every worker.", async () => {
        const pool = new ThreadPool(2);
        const promise = pool.start({ entry: "./worker.js" }, 2);
        createdWorkers.forEach((w) => w.emit("online"));
        await promise;

        pool.sendAll({ broadcast: true });
        for (const worker of createdWorkers) {
            expect(worker.messages).toContainEqual({ broadcast: true });
        }
    });

    describe("sendTo()", () => {
        it("Posts the message to the worker with the given id.", async () => {
            const pool = new ThreadPool(2);
            const promise = pool.start({ entry: "./worker.js" }, 2);
            createdWorkers.forEach((w) => w.emit("online"));
            await promise;

            pool.sendTo(1, { n: 1 });
            expect(createdWorkers[1].messages).toEqual([{ n: 1 }]);
            expect(createdWorkers[0].messages).toEqual([]);
        });

        it("Does nothing for an id with no worker.", async () => {
            const pool = new ThreadPool(1);
            const promise = pool.start({ entry: "./worker.js" }, 1);
            createdWorkers.forEach((w) => w.emit("online"));
            await promise;

            expect(() => pool.sendTo(99, { n: 1 })).not.toThrow();
        });
    });
});
