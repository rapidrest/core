///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
// SPDX-License-Identifier: MPL-2.0
///////////////////////////////////////////////////////////////////////////////
import * as fs from "fs";
import { MESSAGE } from "triple-beam";
import { FILENAME, Logger, logFormat, source } from "../src/Logger.js";
import { describe, it, expect, afterAll } from "vitest";

const logFileName = "test-logger-output";

/**
 * Temporarily overrides `Error.prepareStackTrace` so that any `Error` constructed while `fn` runs reports
 * `rawLines` (prefixed with "    ") as its stack, regardless of the real call site. This gives deterministic
 * control over the exact stack shape that `source()` parses.
 */
function withStack<T>(rawLines: string[], fn: () => T): T {
    const original = Error.prepareStackTrace;
    Error.prepareStackTrace = () => ["Error", ...rawLines.map((line) => `    ${line}`)].join("\n");
    try {
        return fn();
    } finally {
        Error.prepareStackTrace = original;
    }
}

describe("Logger Tests", () => {
    afterAll(() => {
        fs.rmSync(`${logFileName}.log`, { force: true });
        fs.rmSync(`${logFileName}error.log`, { force: true });
    });

    it("Can create a logger that writes to file.", () => {
        const logger = Logger("debug", logFileName);
        expect(logger).toBeDefined();
    });

    it("Does not write ANSI color codes into the log file.", async () => {
        const name = "test-logger-no-ansi";
        const logger = Logger("debug", name);
        const message = "plain text log line";
        logger.info(message);

        // The File transport writes asynchronously; poll briefly for the write to land instead of assuming a
        // fixed delay is enough.
        let content = "";
        for (let i = 0; i < 50; i++) {
            if (fs.existsSync(`${name}.log`)) {
                content = fs.readFileSync(`${name}.log`, "utf8");
                if (content.includes(message)) {
                    break;
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 20));
        }

        expect(content).toContain(message);
        // eslint-disable-next-line no-control-regex
        expect(content).not.toMatch(/\x1b\[\d+m/);

        fs.rmSync(`${name}.log`, { force: true });
        fs.rmSync(`${name}error.log`, { force: true });
    });

    it("Returns the same cached logger instance for identical arguments.", () => {
        const logger1 = Logger("debug", logFileName);
        const logger2 = Logger("debug", logFileName);
        expect(logger1).toBe(logger2);
    });

    it("Can create a logger without a file.", () => {
        const logger = Logger();
        expect(logger).toBeDefined();
    });

    it("Evicts the oldest cached logger once the cache exceeds its maximum size.", () => {
        const baseName = "test-logger-eviction";
        const names: string[] = [];
        let firstLogger: any;
        try {
            // The cache's max size is 100. Creating 101 distinct file-bound loggers guarantees at least one
            // eviction occurs regardless of how many loggers earlier tests in this file already cached, and
            // that the eviction reaches all the way back to the very first one created here.
            for (let i = 0; i <= 100; i++) {
                const name = `${baseName}-${i}`;
                names.push(name);
                const logger = Logger("debug", name);
                if (i === 0) {
                    firstLogger = logger;
                }
            }

            // Having been evicted, requesting it again must create a brand new instance rather than returning
            // the original (now-stale) cached one.
            const reloaded = Logger("debug", names[0]);
            expect(reloaded).not.toBe(firstLogger);
        } finally {
            for (const name of names) {
                fs.rmSync(`${name}.log`, { force: true });
                fs.rmSync(`${name}error.log`, { force: true });
            }
        }
    });
});

describe("Logger source() format Tests", () => {
    it("Skips frames inside Logger.ts, node_modules, and node internals to find the real caller.", () => {
        const info: any = {};
        withStack(
            [
                `at Format.transform (${FILENAME}:30:5)`,
                "at Format.transform (D:/app/node_modules/logform/combine.js:20:24)",
                "at ModuleJob.run (node:internal/modules/esm/module_job:413:25)",
                "at MyClass.methodName (D:/app/src/MyClass.js:42:10)",
            ],
            () => (source() as any).transform(info),
        );
        expect(info.source).toBe("MyClass.methodName");
    });

    it("Combines info.fqn with the stack-derived method name when both are present.", () => {
        const info: any = { fqn: "com.example.MyClass" };
        withStack(["at MyClass.methodName (D:/app/src/MyClass.js:42:10)"], () => (source() as any).transform(info));
        expect(info.source).toBe("com.example.MyClass.methodName");
    });

    it("Uses info.fqn alone when the matched frame has no method name to combine.", () => {
        const info: any = { fqn: "com.example.Util" };
        withStack(["at standaloneFunction (D:/app/src/util.js:5:2)"], () => (source() as any).transform(info));
        expect(info.source).toBe("com.example.Util");
    });

    it("Uses the bare function name from the stack when info.fqn is not set.", () => {
        const info: any = {};
        withStack(["at standaloneFunction (D:/app/src/util.js:5:2)"], () => (source() as any).transform(info));
        expect(info.source).toBe("standaloneFunction");
    });

    it("Falls back to the paren-less stack frame pattern when the frame has no function name.", () => {
        const info: any = {};
        withStack(["at file:///app/src/module.js:12:3"], () => (source() as any).transform(info));
        expect(info.source).toBe("file:///app/src/module.js");
    });

    it("Leaves info.source undefined when no candidate frame can be parsed.", () => {
        const info: any = {};
        withStack(["at async somewhere:3:4"], () => (source() as any).transform(info));
        expect(info.source).toBeUndefined();
    });

    it("Does not throw and leaves info.source undefined when Error.stack is unavailable.", () => {
        const info: any = {};
        const original = Error.prepareStackTrace;
        Error.prepareStackTrace = () => undefined;
        try {
            (source() as any).transform(info);
        } finally {
            Error.prepareStackTrace = original;
        }
        expect(info.source).toBeUndefined();
    });
});

describe("Logger logFormat Tests", () => {
    it("Omits the [source] prefix when info.source is not set.", () => {
        const info: any = { timestamp: "2026-08-06T00:00:00.000Z", level: "info", message: "hello" };
        const result: any = (logFormat as any).transform(info);
        expect(result[MESSAGE]).toBe("2026-08-06T00:00:00.000Z info: hello");
    });

    it("Prepends the [source] prefix when info.source is set.", () => {
        const info: any = {
            source: "MyClass.methodName",
            timestamp: "2026-08-06T00:00:00.000Z",
            level: "info",
            message: "hello",
        };
        const result: any = (logFormat as any).transform(info);
        expect(result[MESSAGE]).toBe("[MyClass.methodName] 2026-08-06T00:00:00.000Z info: hello");
    });

});
