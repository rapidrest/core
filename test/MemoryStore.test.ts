///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2026 Jean-Philippe Steinmetz. All rights reserved.
///////////////////////////////////////////////////////////////////////////////
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryStore } from "../src/MemoryStore.js";

describe("MemoryStore Tests", () => {
    let store: MemoryStore | undefined;

    afterEach(() => {
        store?.destroy();
        store = undefined;
        vi.useRealTimers();
    });

    describe("constructor", () => {
        it("Initializes with the expected default TTL and max size.", () => {
            store = new MemoryStore();
            expect(store.defaultTTL).toBe(60);
            expect(store.maxSize).toBe(10000);
        });
    });

    describe("load", () => {
        it("Returns undefined for an id that has never been saved.", () => {
            store = new MemoryStore();
            expect(store.load("missing")).toBeUndefined();
        });

        it("Returns the stored data for a valid, non-expired entry.", async () => {
            store = new MemoryStore();
            await store.save("id1", { foo: "bar" });
            expect(store.load("id1")).toEqual({ foo: "bar" });
        });

        it("Removes and returns undefined once an entry's TTL has expired.", async () => {
            vi.useFakeTimers();
            store = new MemoryStore();
            await store.save("id1", { foo: "bar" }, 1);

            vi.advanceTimersByTime(1001);

            expect(store.load("id1")).toBeUndefined();
            // The entry should have been evicted from the underlying map, not just hidden.
            expect((store as any).entries.has("id1")).toBe(false);
        });

        it("Still returns the data one millisecond before the TTL boundary.", async () => {
            vi.useFakeTimers();
            store = new MemoryStore();
            await store.save("id1", { foo: "bar" }, 1);

            vi.advanceTimersByTime(999);

            expect(store.load("id1")).toEqual({ foo: "bar" });
        });

        it("Treats the exact expiry instant (expiresAt === now) as expired, per the <= comparison.", async () => {
            vi.useFakeTimers();
            store = new MemoryStore();
            await store.save("id1", { foo: "bar" }, 1);

            vi.advanceTimersByTime(1000);

            expect(store.load("id1")).toBeUndefined();
        });

        it("Returns the same object reference that was saved, without cloning.", async () => {
            store = new MemoryStore();
            const data = { foo: "bar" };
            await store.save("id1", data);
            expect(store.load("id1")).toBe(data);
        });
    });

    describe("save", () => {
        it("Falls back to defaultTTL when no ttlSeconds is provided.", async () => {
            vi.useFakeTimers();
            const now = Date.now();
            store = new MemoryStore();

            await store.save("id1", { foo: "bar" });

            const entry = (store as any).entries.get("id1");
            expect(entry.expiresAt).toBe(now + store.defaultTTL * 1000);
        });

        it("Uses the given ttlSeconds when provided.", async () => {
            vi.useFakeTimers();
            const now = Date.now();
            store = new MemoryStore();

            await store.save("id1", { foo: "bar" }, 5);

            const entry = (store as any).entries.get("id1");
            expect(entry.expiresAt).toBe(now + 5000);
        });

        it("A ttlSeconds of 0 produces an entry that is immediately expired.", async () => {
            store = new MemoryStore();
            await store.save("id1", { foo: "bar" }, 0);
            expect(store.load("id1")).toBeUndefined();
        });

        it("Overwrites an existing entry with the same id.", async () => {
            store = new MemoryStore();
            await store.save("id1", { foo: "bar" });
            await store.save("id1", { foo: "baz" });
            expect(store.load("id1")).toEqual({ foo: "baz" });
        });

        it("Clears all entries once the store grows beyond maxSize before inserting the new one.", async () => {
            store = new MemoryStore();
            store.maxSize = 1;

            await store.save("id1", { n: 1 });
            await store.save("id2", { n: 2 });
            // At the second save's check, size is 1 (only id1 so far) so 1 > 1 is false; id2 is added
            // without clearing, leaving both entries in place.
            expect((store as any).entries.size).toBe(2);

            // Third save: size is 2 at the check, so 2 > 1 is true and the map is cleared before id3 is inserted.
            await store.save("id3", { n: 3 });
            expect((store as any).entries.size).toBe(1);
            expect(store.load("id3")).toEqual({ n: 3 });
            expect(store.load("id1")).toBeUndefined();
            expect(store.load("id2")).toBeUndefined();
        });
    });

    describe("delete", () => {
        it("Removes an existing entry.", async () => {
            store = new MemoryStore();
            await store.save("id1", { foo: "bar" });
            await store.delete("id1");
            expect(store.load("id1")).toBeUndefined();
        });

        it("Does not throw when deleting an id that was never saved.", async () => {
            store = new MemoryStore();
            await expect(store.delete("missing")).resolves.toBeUndefined();
        });
    });

    describe("background sweep", () => {
        it("Automatically evicts expired entries and keeps live ones when the sweep interval fires.", async () => {
            vi.useFakeTimers();
            store = new MemoryStore();

            await store.save("expired", { n: 1 }, 1);
            await store.save("alive", { n: 2 }, 120);

            // Advance past the entry's own TTL, then past the 60s sweep interval, without calling load() first,
            // so the removal can only be attributed to the internal sweep() timer, not load()'s own expiry check.
            vi.advanceTimersByTime(1001);
            vi.advanceTimersByTime(60_000);

            expect((store as any).entries.has("expired")).toBe(false);
            expect((store as any).entries.has("alive")).toBe(true);
        });
    });

    describe("destroy", () => {
        it("Stops the background sweep timer.", () => {
            store = new MemoryStore();
            const clearIntervalSpy = vi.spyOn(global, "clearInterval");

            store.destroy();

            expect(clearIntervalSpy).toHaveBeenCalledWith((store as any).sweepTimer);
            clearIntervalSpy.mockRestore();
        });

        it("Prevents further sweeps from running once destroyed.", async () => {
            vi.useFakeTimers();
            store = new MemoryStore();
            await store.save("expired", { n: 1 }, 1);

            store.destroy();
            vi.advanceTimersByTime(1001);
            vi.advanceTimersByTime(60_000);

            // The sweep timer no longer runs, but the entry map itself is untouched by destroy().
            expect((store as any).entries.has("expired")).toBe(true);
        });
    });
});
