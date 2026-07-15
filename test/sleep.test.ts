///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import { sleep } from "../src/sleep.js";
import { describe, it, expect } from "vitest";

describe("sleep Tests.", () => {
    it("Resolves after the default duration.", async () => {
        const start = Date.now();
        await sleep();
        expect(Date.now() - start).toBeGreaterThanOrEqual(0);
    });

    it("Resolves after the specified duration.", async () => {
        const start = Date.now();
        await sleep(20);
        expect(Date.now() - start).toBeGreaterThanOrEqual(15);
    });
});
