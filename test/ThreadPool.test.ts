///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import { Logger } from "../src/Logger.js";
import { ThreadPool } from "../src/threads/index.js";
import { sleep } from "../src/sleep.js";
import path from "path";
const os = require("os");
const logger = Logger();
import { describe, it, expect } from "vitest";

describe.skip("ThreadPool Tests.", () => {
    it("Can create thread pool with custom entry and 1 thread.", async () => {
        const pool: ThreadPool = new ThreadPool(1, logger);
        expect(pool).toBeDefined();

        pool.on("error", (threadId: number, err: any) => {
            throw err;
        });

        let exitCode: number = 0;
        pool.on("exit", (threadId: number, code: number) => {
            exitCode = code || exitCode;
        });

        let sum: number = 0;
        pool.on("message", (threadId: number, result: number) => {
            sum += result;
        });

        await pool.start({ entry: "./test/ThreadSimpleJob.js", args: [10] });
        expect(pool.size).toBe(1);

        await sleep(100);
        expect(exitCode).toBeLessThanOrEqual(0);
        expect(sum).toBe(10 * 2);
    });

    it("Can create thread pool with custom entry and n threads.", async () => {
        // Rough calculate based on freemem
        const maxThreads = Math.min(Math.floor(os.freemem() / 500000000), os.cpus().length);
        const pool: ThreadPool = new ThreadPool(maxThreads, logger);
        expect(pool).toBeDefined();

        pool.on("error", (threadId: number, err: any) => {
            throw err;
        });

        let exitCode: number = 0;
        pool.on("exit", (threadId: number, code: number) => {
            exitCode = code || exitCode;
        });

        let sum: number = 0;
        pool.on("message", (threadId: number, result: number) => {
            sum += result;
        });

        await pool.start({ entry: "./test/ThreadSimpleJob.js", args: [10] });
        expect(pool.size).toBe(maxThreads);
        await sleep(100);
        expect(exitCode).toBeLessThanOrEqual(0);
        expect(sum).toBe(10 * 2 * maxThreads);
    });

    it("Can keep recreating threads with custom entry.", async () => {
        // Rough calculate based on freemem
        const maxThreads = Math.min(Math.floor(os.freemem() / 500000000), os.cpus().length);
        const pool: ThreadPool = new ThreadPool(maxThreads, logger);
        expect(pool).toBeDefined();

        pool.on("error", (threadId: number, err: any) => {
            throw err;
        });

        let exitCode: number = 0;
        pool.on("exit", (threadId: number, code: number) => {
            exitCode = code || exitCode;
        });

        let sum: number = 0;
        pool.on("message", (threadId: number, result: number) => {
            sum += result;
        });

        await pool.start({ entry: "./test/ThreadSimpleJob.js", args: [10], restartOnExit: true });
        expect(pool.size).toBe(maxThreads);

        await sleep(1000);
        expect(exitCode).toBeLessThanOrEqual(0);
        expect(sum).toBeGreaterThanOrEqual(10 * 2 * maxThreads);
        await pool.stop();
    });

    it("Can create script pool with 1 thread.", async () => {
        const pool: ThreadPool = new ThreadPool(1, logger);
        expect(pool).toBeDefined();

        pool.on("error", (threadId: number, err: any) => {
            throw err;
        });

        let exitCode: number = 0;
        pool.on("exit", (threadId: number, code: number) => {
            exitCode = code || exitCode;
        });

        let started: boolean = false;
        let stopMessage: boolean = false;
        let updateMessage: any = undefined;
        pool.on("online", (threadId: number) => {
            started = true;
        });
        pool.on("message", (threadId: number, msg: any) => {
            console.log("Received message.");
            switch (msg.type) {
                case "WorkerStopped":
                    stopMessage = true;
                // eslint-disable-next-line no-fallthrough
                case "WorkerUpdate":
                    updateMessage = msg;
                    break;
            }
        });

        await pool.start({ worker: path.join(__dirname, "TestThreadWorker.ts"), args: [0, 100] });
        expect(started).toBeTruthy();
        expect(pool.size).toBe(1);
        await sleep(1000);
        pool.send({ type: "WorkerUpdate" });
        await sleep(100);
        expect(updateMessage).toBeDefined();
        expect(updateMessage.num).toBeGreaterThanOrEqual(9);

        await pool.stop();
        await sleep(10);
        expect(stopMessage).toBeTruthy();
        expect(exitCode).toBe(0);
    });

    it("Can create script pool with n threads.", async () => {
        // Rough calculate based on freemem
        const maxThreads = Math.min(Math.floor(os.freemem() / 500000000), os.cpus().length);
        const pool: ThreadPool = new ThreadPool(maxThreads, logger);
        expect(pool).toBeDefined();

        pool.on("error", (threadId: number, err: any) => {
            throw err;
        });

        let exitCode: number = 0;
        pool.on("exit", (threadId: number, code: number) => {
            exitCode = code || exitCode;
        });

        let started: boolean = false;
        let stopMessages: Map<number, boolean> = new Map();
        let updateMessages: Map<number, any> = new Map();
        pool.on("online", (threadId: number) => {
            started = true;
        });
        pool.on("message", (threadId: number, msg: any) => {
            console.log("Received message.");
            switch (msg.type) {
                case "WorkerStopped":
                    stopMessages.set(threadId, true);
                    break;
                case "WorkerUpdate":
                    updateMessages.set(threadId, msg);
                    break;
            }
        });
        await pool.start({ worker: path.join(__dirname, "TestThreadWorker.ts"), args: [0, 100] });
        expect(started).toBeTruthy();
        expect(pool.size).toBe(maxThreads);
        await sleep(1000);
        pool.sendAll({ type: "WorkerUpdate" });
        await sleep(100);
        expect(updateMessages.size).toBe(pool.size);
        for (const updateMessage of updateMessages.values()) {
            expect(updateMessage).toBeDefined();
            expect(updateMessage.num).toBeGreaterThanOrEqual(9);
        }

        await pool.stop();
        await sleep(100);
        expect(stopMessages.size).toBe(pool.size);
        for (const stopMessage of stopMessages.values()) {
            expect(stopMessage).toBeTruthy();
        }
        expect(exitCode).toBe(0);
    });
});
