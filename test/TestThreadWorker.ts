///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import { clearInterval } from "timers";
import { ThreadWorker } from "../src/threads/ThreadWorker.js";
import { parentPort } from "worker_threads";

export default class TestThreadWorker extends ThreadWorker {
    private interval: NodeJS.Timeout | null = null;
    private num: number = 0;
    private tickRate: number = 10;

    constructor(logger: any, num: number, tickRate: number) {
        super(logger);
        this.num = num;
        this.tickRate = tickRate;
    }

    public onMessage(msg: any) {
        if (msg.type === "WorkerUpdate") {
            parentPort?.postMessage({
                type: "WorkerUpdate",
                num: this.num,
            });
        }
    }

    private run() {
        this.num++;
    }

    public start() {
        this.interval = setInterval(this.run.bind(this), this.tickRate);

        parentPort?.postMessage({
            type: "WorkerStarted",
            num: this.num,
        });
    }

    public stop() {
        parentPort?.postMessage({
            type: "WorkerStopped",
            num: this.num,
        });
        if (this.interval) {
            clearInterval(this.interval);
        }
    }
}
