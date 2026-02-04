///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import { parentPort, threadId } from "worker_threads";

/**
 * Provides a Winston transport for forwarding logs from this thread to the parent's logger instance.
 *
 * Constructor requires two properties to be set in the `opts` argument:
 * - `parentPort`
 * - `threadId`
 */
class ThreadLogger {
    log(data) {
        if (typeof data !== "object") {
            data = {
                level: "info",
                message: data,
            };
        }

        // Prefix the thread ID to the message
        data.message = `[Thread-${threadId}]: ${data.message}`;

        // Forward the log to the parent thread
        parentPort?.postMessage({
            type: "_WorkerLog",
            data,
        });
    }

    debug(message) {
        this.log({ level: "debug", message });
    }

    error(message) {
        this.log({ level: "error", message });
    }

    info(message) {
        this.log({ level: "info", message });
    }

    warn(message) {
        this.log({ level: "warn", message });
    }
}

module.exports = ThreadLogger;
