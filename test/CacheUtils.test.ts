///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2026 Jean-Philippe Steinmetz. All rights reserved.
///////////////////////////////////////////////////////////////////////////////
import { CacheUtils } from "../src/CacheUtils.js";
import { describe, it, expect } from "vitest";

describe("CacheUtils Tests.", () => {
    it("evictOldest removes the least-recently-inserted entry.", () => {
        const map = new Map<string, number>([
            ["a", 1],
            ["b", 2],
            ["c", 3],
        ]);
        CacheUtils.evictOldest(map);
        expect(map.has("a")).toBe(false);
        expect(map.has("b")).toBe(true);
        expect(map.has("c")).toBe(true);
    });

    it("evictOldest does nothing (and does not throw) for an empty map.", () => {
        const map = new Map<string, number>();
        expect(() => CacheUtils.evictOldest(map)).not.toThrow();
        expect(map.size).toBe(0);
    });
});
