///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import * as fs from "fs";
import { Logger } from "../src/Logger.js";
import { describe, it, expect, afterAll } from "vitest";

const logFileName = "test-logger-output";

describe("Logger Tests", () => {
    afterAll(() => {
        fs.rmSync(`${logFileName}.log`, { force: true });
        fs.rmSync(`${logFileName}error.log`, { force: true });
    });

    it("Can create a logger that writes to file.", () => {
        const logger = Logger("debug", logFileName);
        expect(logger).toBeDefined();
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
});
