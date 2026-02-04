///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import { parentPort, workerData } from "worker_threads";
import Logger from "./ThreadLogger";

const logger = new Logger();

logger.debug(`Starting ThreadWorkerEntry...`);
logger.debug(`WorkerData: ${JSON.stringify(workerData)}`);

// Register for parent messages
if (workerData) {
    let worker = null;

    try {
        // Load the TypeScript environment if enabled
        if (workerData.allowTs) {
            require("ts-node").register();
        }

        // Import the worker class and initialize
        logger.debug(`Loading worker: ${workerData.worker}`);
        const mod = require(workerData.worker);
        if (typeof mod.default !== "function") {
            throw new Error(`No default export found for worker: ${workerPath}`);
        }

        logger.debug(`Initializing worker...`);
        const clazz = mod.default;
        const args = workerData.args || [];
        worker = new clazz(logger, ...args);
        void worker.start();

        parentPort.on("message", async (msg) => {
            try {
                switch (msg.type) {
                    case "_StartWorker":
                        await worker?.start();
                        break;
                    case "_StopWorker":
                        logger.debug(`Stopping worker...`);
                        await worker?.stop();
                        process.exit(0);
                        break;
                    default:
                        await worker?.onMessage(msg);
                        break;
                }
            } catch (error) {
                parentPort?.postMessage({
                    type: "_WorkerError",
                    data: error,
                });
            }
        });
        parentPort.on("close", async () => {
            logger.debug(`Stopping worker...`);
            await worker?.stop();
            process.exit(0);
        });

        // Notify the coordinator that we're ready
        parentPort?.postMessage({ type: "_WorkerOnline" });
        logger.debug(`Worker is online!`);
    } catch (error) {
        parentPort?.postMessage({
            type: "_WorkerError",
            data: error,
        });
        logger.error(`An error occurred initializing worker.`);
        logger.error(error);
    }
} else {
    logger.error(`WorkerData is missing.`);
    parentPort?.postMessage({
        type: "_WorkerError",
        data: new Error("WorkerData is missing."),
    });
}
