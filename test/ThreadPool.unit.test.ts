///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
// Unit-level tests for ThreadPool that mock out `worker_threads` entirely. The real-thread integration test in
// ThreadPool.test.ts is kept (but skipped, see that file for why) as a reference for real-world usage; spinning up
// actual OS threads is slow and, on Windows, hits a separate ESM loader bug (ERR_UNSUPPORTED_ESM_URL_SCHEME)
// unrelated to ThreadPool's own logic. Mocking `Worker` lets us deterministically drive every event/branch here.
import { EventEmitter } from "events";
import os from "os";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let createdWorkers: MockWorker[] = [];
// When set, the *next* MockWorker construction throws synchronously instead of succeeding, simulating a
// `new Worker(...)` failure (e.g. non-cloneable workerData, thread-limit/OOM) for restartOnExit tests.
let throwOnNextConstruct = false;

class MockWorker extends EventEmitter {
    public messages: any[] = [];
    public terminate = vi.fn(async () => 0);
    public entry: string;
    public options: any;
    // Mirrors real `worker_threads.Worker`: once "exit" has fired, `postMessage()` throws synchronously.
    public exited = false;
    constructor(entry: string, options: any) {
        super();
        if (throwOnNextConstruct) {
            throwOnNextConstruct = false;
            throw new Error("Simulated worker construction failure");
        }
        this.entry = entry;
        this.options = options;
        this.on("exit", () => {
            this.exited = true;
        });
        createdWorkers.push(this);
    }
    postMessage(msg: any) {
        if (this.exited) {
            throw new Error("Worker has already exited (ERR_WORKER_NOT_RUNNING)");
        }
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
    throwOnNextConstruct = false;
});

afterEach(() => {
    vi.useRealTimers();
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

    it("Does not mutate the caller's options object.", async () => {
        // Regression test: start()/createWorker() used to write `allowTs`/`entry` directly onto the caller's
        // own options object. A frozen options object - a defensive pattern a caller might reasonably use -
        // used to make start() throw ("Cannot add property entry, object is not extensible") instead of
        // starting the pool.
        const pool = new ThreadPool(1);
        const opts = Object.freeze({ worker: "./MyWorker.js", args: [1, 2, 3] });
        const promise = pool.start(opts, 1);
        createdWorkers[0].emit("message", { type: WorkerMessageType.ONLINE });
        await expect(promise).resolves.toBeUndefined();

        expect(opts).toEqual({ worker: "./MyWorker.js", args: [1, 2, 3] });
        expect(Object.keys(opts)).not.toContain("entry");
        expect(Object.keys(opts)).not.toContain("allowTs");
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

    it("Waits for every worker-style worker to send ONLINE before resolving start().", async () => {
        const pool = new ThreadPool(2);
        const promise = pool.start({ worker: "./MyWorker.js" }, 2);
        expect(createdWorkers).toHaveLength(2);

        createdWorkers[0].emit("message", { type: WorkerMessageType.ONLINE });
        let resolved = false;
        void promise.then(() => (resolved = true));
        await Promise.resolve();
        expect(resolved).toBe(false);

        createdWorkers[1].emit("message", { type: WorkerMessageType.ONLINE });
        await promise;
        expect(pool.size).toBe(2);
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

    it("Routes a post-startup ERROR message to 'error' callbacks, not 'message' callbacks.", async () => {
        // Regression test: WorkerMessageType.ERROR messages sent after startup (e.g. a runtime exception caught
        // by ThreadWorkerEntry.js's onMessage handler) must be routed the same way the native "error" event is,
        // not silently fall through to "message" listeners where error-monitoring code would never see them.
        const pool = new ThreadPool(1);
        const promise = pool.start({ entry: "./worker.js" }, 1);
        createdWorkers[0].emit("online");
        await promise;

        const errors: any[] = [];
        const messages: any[] = [];
        pool.on("error", (id: number, err: any) => errors.push([id, err]));
        pool.on("message", (id: number, msg: any) => messages.push([id, msg]));

        const err = new Error("worker crashed after startup");
        createdWorkers[0].emit("message", { type: WorkerMessageType.ERROR, data: err });

        expect(errors).toEqual([[0, err]]);
        expect(messages).toEqual([]);
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

    it("Rejects start() when a worker's native 'error' event fires before it becomes ready.", async () => {
        const pool = new ThreadPool(1);
        const promise = pool.start({ entry: "./worker.js" }, 1);
        createdWorkers[0].emit("error", new Error("crashed during startup"));
        await expect(promise).rejects.toThrow("crashed during startup");
    });

    it("Rejects start() after startupTimeoutMs elapses if no worker ever reports readiness or errors.", async () => {
        vi.useFakeTimers();
        const pool = new ThreadPool(1);
        const promise = pool.start({ entry: "./worker.js", startupTimeoutMs: 1000 }, 1);

        let rejected = false;
        let rejectionError: any;
        promise.catch((err) => {
            rejected = true;
            rejectionError = err;
        });

        // Not yet timed out.
        await vi.advanceTimersByTimeAsync(999);
        expect(rejected).toBe(false);

        // The timeout fires, rejecting start() and terminating the worker that never reported readiness.
        await vi.advanceTimersByTimeAsync(1);
        expect(rejected).toBe(true);
        expect(rejectionError.message).toBe("Timed out waiting for worker threads to start after 1000ms.");
        expect(createdWorkers[0].terminate).toHaveBeenCalled();
    });

    it("Clears the startup timeout once start() succeeds, so it never fires afterward.", async () => {
        vi.useFakeTimers();
        const pool = new ThreadPool(1);
        const promise = pool.start({ entry: "./worker.js", startupTimeoutMs: 1000 }, 1);
        createdWorkers[0].emit("online");
        await promise;

        // If the timeout weren't cleared on success, advancing past it would force-terminate the now-healthy
        // worker out from under the caller.
        await vi.advanceTimersByTimeAsync(1000);
        expect(createdWorkers[0].terminate).not.toHaveBeenCalled();
    });

    it("Terminates every worker created during a failed multi-worker start() instead of leaking siblings.", async () => {
        const pool = new ThreadPool(2);
        const promise = pool.start({ entry: "./worker.js" }, 2);
        expect(createdWorkers).toHaveLength(2);

        createdWorkers[0].emit("error", new Error("worker 0 crashed"));
        await expect(promise).rejects.toThrow("worker 0 crashed");

        for (const worker of createdWorkers) {
            expect(worker.terminate).toHaveBeenCalled();
        }
        expect(pool.workers).toHaveLength(0);
    });

    it("Only fails start() once even if multiple workers error concurrently.", async () => {
        const pool = new ThreadPool(2);
        const promise = pool.start({ entry: "./worker.js" }, 2);

        // Both workers error before either becomes ready. The second failStartup() call must be a no-op:
        // it must not re-terminate already-terminated workers or attempt to reject an already-settled promise.
        createdWorkers[0].emit("error", new Error("first failure"));
        const secondWorkerTerminate = createdWorkers[1].terminate;
        createdWorkers[1].emit("error", new Error("second failure"));

        await expect(promise).rejects.toThrow("first failure");
        expect(secondWorkerTerminate).toHaveBeenCalledTimes(1);
    });

    it("Ignores late 'online'/'message' events that arrive after start() has already failed.", async () => {
        const pool = new ThreadPool(2);
        const promise = pool.start({ worker: "./MyWorker.js" }, 2);

        createdWorkers[0].emit("message", { type: WorkerMessageType.ERROR, data: new Error("boom") });
        await expect(promise).rejects.toThrow("boom");

        // The pool is already torn down (workers terminated/cleared); the surviving worker's late readiness
        // signals must not throw or attempt to resolve/reject the already-settled promise.
        expect(() => createdWorkers[1].emit("online")).not.toThrow();
        expect(() => createdWorkers[1].emit("message", { type: WorkerMessageType.ONLINE })).not.toThrow();
        expect(pool.workers).toHaveLength(0);
    });

    it("Resolves immediately without creating workers when the requested count is zero.", async () => {
        const pool = new ThreadPool(1);
        await pool.start({ entry: "./worker.js" }, 0);
        expect(createdWorkers).toHaveLength(0);
        expect(pool.size).toBe(0);
    });

    it("Terminates leftover workers from a previous start() call instead of leaking them.", async () => {
        const pool = new ThreadPool(1);
        const firstPromise = pool.start({ entry: "./worker.js" }, 1);
        createdWorkers[0].emit("online");
        await firstPromise;

        const firstWorker = createdWorkers[0];
        const removeAllListenersSpy = vi.spyOn(firstWorker, "removeAllListeners");

        const secondPromise = pool.start({ entry: "./worker.js" }, 1);
        createdWorkers[1].emit("online");
        await secondPromise;

        expect(removeAllListenersSpy).toHaveBeenCalled();
        expect(firstWorker.terminate).toHaveBeenCalled();
        expect(pool.workers[0]).toBe(createdWorkers[1]);
    });

    it("Notifies registered 'online' callbacks for entry-mode pools via the native online event.", async () => {
        const pool = new ThreadPool(1);
        const onlineIds: number[] = [];
        pool.on("online", (id: number) => onlineIds.push(id));

        const promise = pool.start({ entry: "./worker.js" }, 1);
        createdWorkers[0].emit("online");
        await promise;

        expect(onlineIds).toEqual([0]);
    });

    it("Recovers start()'s promise when a worker exits and is replaced via restartOnExit before ever becoming ready.", async () => {
        const pool = new ThreadPool(1);
        const promise = pool.start({ entry: "./worker.js", restartOnExit: true }, 1);
        expect(createdWorkers).toHaveLength(1);

        // The initial worker crashes before ever reporting ready. restartOnExit replaces it, and the
        // *replacement* becoming ready must still resolve start()'s promise instead of leaving it hanging
        // forever with no listener tracking the new worker's readiness.
        createdWorkers[0].emit("exit", 1);
        expect(createdWorkers).toHaveLength(2);

        let resolved = false;
        void promise.then(() => (resolved = true));
        await Promise.resolve();
        expect(resolved).toBe(false);

        createdWorkers[1].emit("online");
        await promise;
        expect(pool.size).toBe(1);
        expect(pool.workers[0]).toBe(createdWorkers[1]);
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

    it("Reports an 'error' event instead of throwing when restartOnExit's worker recreation fails synchronously.", async () => {
        const pool = new ThreadPool(1);
        const promise = pool.start({ entry: "./worker.js", restartOnExit: true }, 1);
        createdWorkers[0].emit("online");
        await promise;

        const errors: Array<[number, any]> = [];
        pool.on("error", (id: number, err: any) => errors.push([id, err]));

        // Priming the next MockWorker construction to throw simulates createWorker() failing synchronously
        // during the restart triggered by this exit - the failure must be reported via the "error" listeners
        // rather than escaping as an unhandled promise rejection from the async "exit" handler.
        throwOnNextConstruct = true;
        createdWorkers[0].emit("exit", 1);

        expect(errors).toHaveLength(1);
        expect(errors[0][0]).toBe(0);
        expect(errors[0][1].message).toBe("Simulated worker construction failure");
        // No replacement worker was created, so the pool must not have grown.
        expect(createdWorkers).toHaveLength(1);
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

    it("stop() sends STOP, waits for graceful exit, and fires exit callbacks with the exit() code (no force-terminate).", async () => {
        const pool = new ThreadPool(2);
        const promise = pool.start({ entry: "./worker.js" }, 2);
        createdWorkers.forEach((w) => w.emit("online"));
        await promise;

        createdWorkers[0].terminate = vi.fn(async () => 0);
        createdWorkers[1].terminate = vi.fn(async () => 7);

        const exits: any[] = [];
        pool.on("exit", (id: number, code: number) => exits.push([id, code]));

        const stopPromise = pool.stop();
        // Simulate each worker exiting gracefully on its own (as the real ThreadWorkerEntry.js does after its
        // ThreadWorker.stop() resolves and it calls process.exit()) well within the grace period.
        createdWorkers[0].emit("exit", 0);
        createdWorkers[1].emit("exit", 7);
        await stopPromise;

        for (const worker of createdWorkers) {
            expect(worker.messages).toContainEqual({ type: WorkerMessageType.STOP });
            // A worker that exits on its own within the grace period must not be force-terminated.
            expect(worker.terminate).not.toHaveBeenCalled();
        }
        expect(exits).toEqual(
            expect.arrayContaining([
                [0, 0],
                [1, 7],
            ]),
        );
    });

    it("stop() force-terminates a worker that doesn't exit on its own within the grace period.", async () => {
        vi.useFakeTimers();
        const pool = new ThreadPool(2);
        const promise = pool.start({ entry: "./worker.js" }, 2);
        createdWorkers.forEach((w) => w.emit("online"));
        await promise;

        createdWorkers[0].terminate = vi.fn(async () => 0);
        createdWorkers[1].terminate = vi.fn(async () => 7);

        const exits: any[] = [];
        pool.on("exit", (id: number, code: number) => exits.push([id, code]));

        const stopPromise = pool.stop();
        // Neither worker exits on its own; advance past the grace period so stop() falls back to terminate().
        await vi.advanceTimersByTimeAsync(5000);
        await stopPromise;

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
        // interaction between the "exit" listener registered in createWorker and stop()'s own callback loop. The
        // worker never exits gracefully on its own, so this exercises the force-terminate fallback path.
        vi.useFakeTimers();
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

        const stopPromise = pool.stop();
        await vi.advanceTimersByTimeAsync(5000);
        await stopPromise;

        expect(exits).toEqual([[0, 0]]);
    });

    it("stop() clears the workers array so a stale/terminated worker can't be routed to afterward.", async () => {
        const pool = new ThreadPool(2);
        const promise = pool.start({ entry: "./worker.js" }, 2);
        createdWorkers.forEach((w) => w.emit("online"));
        await promise;

        const stopPromise = pool.stop();
        createdWorkers.forEach((w) => w.emit("exit", 0));
        await stopPromise;

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

        it("Skips a worker that has already exited (e.g. crashed with no restartOnExit) instead of throwing.", async () => {
            const pool = new ThreadPool(2);
            const promise = pool.start({ entry: "./worker.js" }, 2);
            createdWorkers.forEach((w) => w.emit("online"));
            await promise;

            // Targets worker 1 (lastThread starts at 0, so (0+1)%2 = 1), leaving lastThread = 1.
            pool.send({ n: 0 });
            expect(createdWorkers[1].messages).toEqual([{ n: 0 }]);

            // Worker 0 crashes on its own, with no restartOnExit - it stays in `pool.workers` (see the
            // ThreadPool crash-leak fix), so postMessage() on it would throw if called.
            createdWorkers[0].emit("exit", 1);

            // (1+1)%2 = 0 would normally target the now-exited worker 0 - send() must skip it and continue to
            // worker 1 instead of throwing.
            expect(() => pool.send({ n: 1 })).not.toThrow();
            expect(createdWorkers[0].messages).toEqual([]);
            expect(createdWorkers[1].messages).toEqual([{ n: 0 }, { n: 1 }]);
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

    it("sendAll() skips a worker that has already exited instead of throwing, and still delivers to the rest.", async () => {
        const pool = new ThreadPool(2);
        const promise = pool.start({ entry: "./worker.js" }, 2);
        createdWorkers.forEach((w) => w.emit("online"));
        await promise;

        createdWorkers[0].emit("exit", 1);
        expect(() => pool.sendAll({ broadcast: true })).not.toThrow();
        expect(createdWorkers[0].messages).toEqual([]);
        expect(createdWorkers[1].messages).toContainEqual({ broadcast: true });
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

        it("Does nothing for a worker that has already exited instead of throwing.", async () => {
            const pool = new ThreadPool(1);
            const promise = pool.start({ entry: "./worker.js" }, 1);
            createdWorkers.forEach((w) => w.emit("online"));
            await promise;

            createdWorkers[0].emit("exit", 1);
            expect(() => pool.sendTo(0, { n: 1 })).not.toThrow();
            expect(createdWorkers[0].messages).toEqual([]);
        });
    });

    it("stop() does not leak a sibling worker when another has already exited (crashed with no restartOnExit) before stop() was called.", async () => {
        // Regression test for the crash-leak: previously, stop()'s initial sendAll() would throw synchronously
        // on the already-exited worker's postMessage() call, aborting stop() before it ever reached the
        // Promise.all block that terminates/awaits the remaining, still-running siblings.
        const pool = new ThreadPool(2);
        const promise = pool.start({ entry: "./worker.js" }, 2);
        createdWorkers.forEach((w) => w.emit("online"));
        await promise;

        createdWorkers[0].emit("exit", 1);
        expect(pool.workers).toContain(createdWorkers[0]);

        const stopPromise = pool.stop();
        createdWorkers[1].emit("exit", 0);
        await expect(stopPromise).resolves.toBeUndefined();

        expect(createdWorkers[1].messages).toContainEqual({ type: WorkerMessageType.STOP });
        expect(createdWorkers[1].terminate).not.toHaveBeenCalled();
        expect(pool.workers).toHaveLength(0);
    });
});
