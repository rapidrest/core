///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import { parentPort, workerData } from "worker_threads";
import Logger from "./ThreadLogger.js";

const logger = new Logger();

logger.debug(`Starting ThreadWorkerEntry...`);
logger.debug(`WorkerData: ${JSON.stringify(workerData)}`);

// Register for parent messages
if (workerData) {
    let worker = null;

    try {
        // Import the worker class and initialize
        logger.debug(`Loading worker: ${workerData.worker}`);
        const mod = await import(workerData.worker);
        if (typeof mod.default !== "function") {
            throw new Error(`No default export found for worker: ${workerData.worker}`);
        }

        logger.debug(`Initializing worker...`);
        const clazz = mod.default;
        const args = workerData.args || [];
        worker = new clazz(logger, ...args);

        parentPort.on("message", async (msg) => {
            try {
                switch (msg.type) {
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

        // Wait for the worker's own start() to fully complete before announcing readiness, so the coordinator's
        // ThreadPool.start() promise (which resolves on receipt of "_WorkerOnline") never resolves while the
        // worker's async setup (e.g. opening a DB connection) is still in flight.
        await worker.start();

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
        // No message/close listeners were registered above (initialization failed before reaching that
        // point), so without exiting here the thread would sit idle forever, unresponsive to STOP and
        // invisible as a "failed" worker to anything but the ThreadPool's own error/exit handling.
        process.exit(1);
    }
} else {
    logger.error(`WorkerData is missing.`);
    parentPort?.postMessage({
        type: "_WorkerError",
        data: new Error("WorkerData is missing."),
    });
}
