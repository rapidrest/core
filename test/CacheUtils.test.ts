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

    it("evictOldest removes the given number of least-recently-inserted entries.", () => {
        const map = new Map<string, number>([
            ["a", 1],
            ["b", 2],
            ["c", 3],
            ["d", 4],
        ]);
        CacheUtils.evictOldest(map, 2);
        expect(map.has("a")).toBe(false);
        expect(map.has("b")).toBe(false);
        expect(map.has("c")).toBe(true);
        expect(map.has("d")).toBe(true);
    });

    it("evictOldest stops gracefully (without throwing) once num exceeds the map's size.", () => {
        const map = new Map<string, number>([
            ["a", 1],
            ["b", 2],
        ]);
        expect(() => CacheUtils.evictOldest(map, 5)).not.toThrow();
        expect(map.size).toBe(0);
    });
});
