///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import { ThreadWorker, WorkerMessage, WorkerMessageType } from "../src/threads/ThreadWorker.js";
import { describe, it, expect } from "vitest";

class TestWorker extends ThreadWorker {
    public messages: WorkerMessage[] = [];
    public started = false;
    public stopped = false;

    public onMessage(msg: WorkerMessage): void {
        this.messages.push(msg);
    }

    public start(): void {
        this.started = true;
    }

    public stop(): void {
        this.stopped = true;
    }
}

describe("ThreadWorker Tests.", () => {
    it("Stores the provided logger on construction.", () => {
        const logger = { debug: () => undefined };
        const worker = new TestWorker(logger);
        expect((worker as any).logger).toBe(logger);
    });

    it("Concrete subclasses can implement the abstract lifecycle methods.", () => {
        const worker = new TestWorker(undefined);
        worker.start();
        worker.onMessage({ type: WorkerMessageType.LOG, data: "hi" });
        worker.stop();

        expect(worker.started).toBe(true);
        expect(worker.stopped).toBe(true);
        expect(worker.messages).toEqual([{ type: WorkerMessageType.LOG, data: "hi" }]);
    });
});
