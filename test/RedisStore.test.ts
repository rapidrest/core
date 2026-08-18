///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2026 Jean-Philippe Steinmetz. All rights reserved.
///////////////////////////////////////////////////////////////////////////////
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Redis } from "ioredis";
import { RedisStore } from "../src/RedisStore.js";

/**
 * Builds a fresh RedisStore backed by a mock ioredis client whose `multi().exec()`, `setex()` and `del()` calls
 * are individually inspectable/controllable per test.
 */
function createStore(): {
    store: RedisStore<number>;
    execMock: ReturnType<typeof vi.fn>;
    multiMock: ReturnType<typeof vi.fn>;
    setexMock: ReturnType<typeof vi.fn>;
    delMock: ReturnType<typeof vi.fn>;
} {
    const execMock = vi.fn().mockResolvedValue(null);
    const multiMock = vi.fn(() => ({ exec: execMock }));
    const setexMock = vi.fn().mockResolvedValue("OK");
    const delMock = vi.fn().mockResolvedValue(1);
    const client = { multi: multiMock, setex: setexMock, del: delMock } as unknown as Redis;
    const store = new RedisStore<number>(client);
    return { store, execMock, multiMock, setexMock, delMock };
}

describe("RedisStore Tests", () => {
    let store: RedisStore<number> | undefined;

    afterEach(() => {
        store?.destroy();
        store = undefined;
        vi.useRealTimers();
    });

    describe("constructor", () => {
        it("Initializes with the expected default TTL and max size.", () => {
            ({ store } = createStore());
            expect(store.defaultTTL).toBe(60);
            expect(store.maxSize).toBe(10000);
        });
    });

    describe("without a redis client (in-memory only mode)", () => {
        it("Constructs without throwing when no client is given.", () => {
            store = new RedisStore<number>();
            expect(store.defaultTTL).toBe(60);
            expect(store.maxSize).toBe(10000);
        });

        it("Returns undefined for an id that was never saved, without attempting to contact redis.", async () => {
            store = new RedisStore<number>();
            await expect(store.load("missing")).resolves.toBeUndefined();
        });

        it("save() then load() round-trips purely through the local map.", async () => {
            store = new RedisStore<number>();
            await store.save("id1", { foo: 1 });
            await expect(store.load("id1")).resolves.toEqual({ foo: 1 });
        });

        it("Treats an expired local entry as a real miss (there is no redis to fall back to).", async () => {
            vi.useFakeTimers();
            store = new RedisStore<number>();
            await store.save("id1", { foo: 1 }, 1);

            vi.advanceTimersByTime(1001);

            await expect(store.load("id1")).resolves.toBeUndefined();
        });

        it("delete() removes the local entry without throwing.", async () => {
            store = new RedisStore<number>();
            await store.save("id1", { foo: 1 });

            await expect(store.delete("id1")).resolves.toBeUndefined();
            await expect(store.load("id1")).resolves.toBeUndefined();
        });

        it("Still evicts the oldest entry once at maxSize.", async () => {
            store = new RedisStore<number>();
            store.maxSize = 2;

            await store.save("id1", { n: 1 });
            await store.save("id2", { n: 2 });
            await store.save("id3", { n: 3 });

            expect((store as any).entries.size).toBe(2);
            await expect(store.load("id1")).resolves.toBeUndefined();
        });

        it("Still runs the background sweep to reclaim expired entries.", async () => {
            vi.useFakeTimers();
            store = new RedisStore<number>();

            await store.save("expired", { n: 1 }, 1);
            await store.save("alive", { n: 2 }, 120);

            vi.advanceTimersByTime(1001);
            vi.advanceTimersByTime(60_000);

            expect((store as any).entries.has("expired")).toBe(false);
            expect((store as any).entries.has("alive")).toBe(true);
        });
    });

    describe("load", () => {
        it("Returns undefined for an id that has never been saved and isn't in redis.", async () => {
            let execMock: ReturnType<typeof vi.fn>;
            ({ store, execMock } = createStore());
            execMock.mockResolvedValue(null);

            await expect(store.load("missing")).resolves.toBeUndefined();
        });

        it("Returns the stored data for a valid, non-expired local entry without contacting redis.", async () => {
            let execMock: ReturnType<typeof vi.fn>;
            let setexMock: ReturnType<typeof vi.fn>;
            ({ store, execMock, setexMock } = createStore());

            await store.save("id1", { foo: 1 });
            expect(setexMock).toHaveBeenCalledTimes(1);

            await expect(store.load("id1")).resolves.toEqual({ foo: 1 });
            // The local copy is fresh, so load() must not need to touch redis at all.
            expect(execMock).not.toHaveBeenCalled();
        });

        it("Falls back to redis on a local cache miss, caching the result locally.", async () => {
            let execMock: ReturnType<typeof vi.fn>;
            ({ store, execMock } = createStore());
            execMock.mockResolvedValue([
                [null, JSON.stringify({ foo: 2 })],
                [null, 120],
            ]);

            await expect(store.load("id1")).resolves.toEqual({ foo: 2 });
            expect((store as any).entries.get("id1")).toEqual({
                data: { foo: 2 },
                expiresAt: expect.any(Number),
            });
        });

        it("Returns undefined when redis has no record for the id (GET returns null).", async () => {
            let execMock: ReturnType<typeof vi.fn>;
            ({ store, execMock } = createStore());
            execMock.mockResolvedValue([
                [null, null],
                [null, -2],
            ]);

            await expect(store.load("missing")).resolves.toBeUndefined();
            expect((store as any).entries.has("missing")).toBe(false);
        });

        it("Returns undefined when the multi transaction itself fails to execute (exec resolves null).", async () => {
            let execMock: ReturnType<typeof vi.fn>;
            ({ store, execMock } = createStore());
            execMock.mockResolvedValue(null);

            await expect(store.load("id1")).resolves.toBeUndefined();
        });

        it("Treats a falsy (empty-string) GET reply the same as a miss.", async () => {
            let execMock: ReturnType<typeof vi.fn>;
            ({ store, execMock } = createStore());
            execMock.mockResolvedValue([
                [null, ""],
                [null, 60],
            ]);

            await expect(store.load("id1")).resolves.toBeUndefined();
            expect((store as any).entries.has("id1")).toBe(false);
        });

        it("Falls back to `undefined` ttl when redis's TTL reply is nullish.", async () => {
            let execMock: ReturnType<typeof vi.fn>;
            ({ store, execMock } = createStore());
            execMock.mockResolvedValue([
                [null, JSON.stringify({ foo: 3 })],
                [null, null],
            ]);

            await expect(store.load("id1")).resolves.toEqual({ foo: 3 });
        });

        it(
            "Re-checks redis once the local copy has expired, instead of reporting not-found from stale local " +
                "state (another process may have renewed the entry with a longer TTL in the interim).",
            async () => {
                let execMock: ReturnType<typeof vi.fn>;
                vi.useFakeTimers();
                ({ store, execMock } = createStore());

                await store.save("id1", { foo: 1 }, 1);
                vi.advanceTimersByTime(1001);

                // Simulate another process having renewed the key in redis with fresh data/TTL before our local
                // copy's (now-expired) clock caught up.
                execMock.mockResolvedValue([
                    [null, JSON.stringify({ foo: 99 })],
                    [null, 120],
                ]);

                await expect(store.load("id1")).resolves.toEqual({ foo: 99 });
                expect(execMock).toHaveBeenCalledTimes(1);
            }
        );

        it("Evicts the oldest local entry once load()'s redis-fallback path would exceed maxSize.", async () => {
            let execMock: ReturnType<typeof vi.fn>;
            ({ store, execMock } = createStore());
            store.maxSize = 2;

            execMock.mockResolvedValueOnce([
                [null, JSON.stringify({ n: 1 })],
                [null, 60],
            ]);
            await store.load("id1");

            execMock.mockResolvedValueOnce([
                [null, JSON.stringify({ n: 2 })],
                [null, 60],
            ]);
            await store.load("id2");
            expect((store as any).entries.size).toBe(2);

            // A third distinct id, fetched from redis, should evict the oldest (id1) rather than growing past
            // maxSize.
            execMock.mockResolvedValueOnce([
                [null, JSON.stringify({ n: 3 })],
                [null, 60],
            ]);
            await store.load("id3");

            expect((store as any).entries.size).toBe(2);
            expect((store as any).entries.has("id1")).toBe(false);
            expect((store as any).entries.has("id2")).toBe(true);
            expect((store as any).entries.has("id3")).toBe(true);
        });

        it("Reclaims already-expired local entries before evicting a live one, on the redis-fallback path.", async () => {
            let execMock: ReturnType<typeof vi.fn>;
            vi.useFakeTimers();
            ({ store, execMock } = createStore());
            store.maxSize = 2;

            await store.save("expired", { n: 1 }, 1);
            await store.save("alive", { n: 2 }, 120);
            vi.advanceTimersByTime(1001);

            execMock.mockResolvedValueOnce([
                [null, JSON.stringify({ n: 3 })],
                [null, 60],
            ]);
            await store.load("id3");

            expect((store as any).entries.size).toBe(2);
            expect((store as any).entries.has("expired")).toBe(false);
            expect((store as any).entries.has("alive")).toBe(true);
            expect((store as any).entries.has("id3")).toBe(true);
        });
    });

    describe("save", () => {
        it("Persists to redis via setex with the correct argument order (key, seconds, value).", async () => {
            let setexMock: ReturnType<typeof vi.fn>;
            ({ store, setexMock } = createStore());

            await store.save("id1", { foo: 1 }, 5);

            expect(setexMock).toHaveBeenCalledWith("id1", 5, JSON.stringify({ foo: 1 }));
        });

        it("Falls back to defaultTTL when no ttl is provided.", async () => {
            let setexMock: ReturnType<typeof vi.fn>;
            vi.useFakeTimers();
            const now = Date.now();
            ({ store, setexMock } = createStore());

            await store.save("id1", { foo: 1 });

            expect(setexMock).toHaveBeenCalledWith("id1", store.defaultTTL, JSON.stringify({ foo: 1 }));
            const entry = (store as any).entries.get("id1");
            expect(entry.expiresAt).toBe(now + store.defaultTTL * 1000);
        });

        it("Uses the given ttl when provided.", async () => {
            vi.useFakeTimers();
            const now = Date.now();
            ({ store } = createStore());

            await store.save("id1", { foo: 1 }, 5);

            const entry = (store as any).entries.get("id1");
            expect(entry.expiresAt).toBe(now + 5000);
        });

        it("Stores the exact data object reference locally, without cloning.", async () => {
            ({ store } = createStore());
            const data = { foo: 1 };

            await store.save("id1", data);

            expect((store as any).entries.get("id1").data).toBe(data);
        });

        it("Overwrites an existing entry with the same id.", async () => {
            ({ store } = createStore());

            await store.save("id1", { foo: 1 });
            await store.save("id1", { foo: 2 });

            await expect(store.load("id1")).resolves.toEqual({ foo: 2 });
        });

        it("Evicts the single oldest entry once the store is at maxSize, without touching the others.", async () => {
            ({ store } = createStore());
            store.maxSize = 2;

            await store.save("id1", { n: 1 });
            await store.save("id2", { n: 2 });
            expect((store as any).entries.size).toBe(2);

            await store.save("id3", { n: 3 });
            expect((store as any).entries.size).toBe(2);
            expect((store as any).entries.has("id1")).toBe(false);
        });

        it("Reclaims already-expired entries before evicting a live one.", async () => {
            vi.useFakeTimers();
            ({ store } = createStore());
            store.maxSize = 2;

            await store.save("expired", { n: 1 }, 1);
            await store.save("alive", { n: 2 }, 120);
            vi.advanceTimersByTime(1001);

            await store.save("id3", { n: 3 });
            expect((store as any).entries.size).toBe(2);
            expect((store as any).entries.has("alive")).toBe(true);
            expect((store as any).entries.has("id3")).toBe(true);
        });

        it("Overwriting an existing id at capacity does not evict anything.", async () => {
            ({ store } = createStore());
            store.maxSize = 2;

            await store.save("id1", { n: 1 });
            await store.save("id2", { n: 2 });
            await store.save("id1", { n: 99 });

            expect((store as any).entries.size).toBe(2);
            expect((store as any).entries.has("id2")).toBe(true);
        });

        it(
            "Leaves the local cache untouched when the redis write fails, instead of reporting a value as saved " +
                "that never made it to the shared store.",
            async () => {
                let setexMock: ReturnType<typeof vi.fn>;
                ({ store, setexMock } = createStore());
                setexMock.mockRejectedValue(new Error("connection lost"));

                await expect(store.save("id1", { foo: 1 })).rejects.toThrow("connection lost");
                expect((store as any).entries.has("id1")).toBe(false);
            }
        );

        it("Does not evict an existing entry from the local map when a redis write fails for a new id.", async () => {
            let setexMock: ReturnType<typeof vi.fn>;
            ({ store, setexMock } = createStore());
            store.maxSize = 1;

            await store.save("id1", { n: 1 });

            setexMock.mockRejectedValueOnce(new Error("connection lost"));
            await expect(store.save("id2", { n: 2 })).rejects.toThrow("connection lost");

            expect((store as any).entries.size).toBe(1);
            expect((store as any).entries.has("id1")).toBe(true);
        });
    });

    describe("delete", () => {
        it("Removes an existing local entry and issues a redis DEL.", async () => {
            let delMock: ReturnType<typeof vi.fn>;
            ({ store, delMock } = createStore());

            await store.save("id1", { foo: 1 });
            await store.delete("id1");

            expect(delMock).toHaveBeenCalledWith("id1");
            expect((store as any).entries.has("id1")).toBe(false);
        });

        it("Does not throw when deleting an id that was never saved locally.", async () => {
            let delMock: ReturnType<typeof vi.fn>;
            ({ store, delMock } = createStore());

            await expect(store.delete("missing")).resolves.toBeUndefined();
            expect(delMock).toHaveBeenCalledWith("missing");
        });
    });

    describe("background sweep", () => {
        it("Automatically evicts expired entries and keeps live ones when the sweep interval fires.", async () => {
            vi.useFakeTimers();
            ({ store } = createStore());

            await store.save("expired", { n: 1 }, 1);
            await store.save("alive", { n: 2 }, 120);

            vi.advanceTimersByTime(1001);
            vi.advanceTimersByTime(60_000);

            expect((store as any).entries.has("expired")).toBe(false);
            expect((store as any).entries.has("alive")).toBe(true);
        });
    });

    describe("destroy", () => {
        it("Stops the background sweep timer.", () => {
            ({ store } = createStore());
            const clearIntervalSpy = vi.spyOn(global, "clearInterval");

            store.destroy();

            expect(clearIntervalSpy).toHaveBeenCalledWith((store as any).sweepTimer);
            clearIntervalSpy.mockRestore();
        });

        it("Prevents further sweeps from running once destroyed.", async () => {
            vi.useFakeTimers();
            ({ store } = createStore());
            await store.save("expired", { n: 1 }, 1);

            store.destroy();
            vi.advanceTimersByTime(1001);
            vi.advanceTimersByTime(60_000);

            expect((store as any).entries.has("expired")).toBe(true);
        });
    });
});
