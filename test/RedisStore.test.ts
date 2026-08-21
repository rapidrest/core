///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2026 Jean-Philippe Steinmetz. All rights reserved.
///////////////////////////////////////////////////////////////////////////////
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RedisClientType } from "redis";
import { RedisStore } from "../src/RedisStore.js";

/** Wraps a series of key-batches as the async iterable returned by `client.scanIterator()`. */
function scanPages(...pages: string[][]): AsyncIterable<string[]> {
    return (async function* () {
        for (const page of pages) {
            yield page;
        }
    })();
}

/**
 * Builds a fresh RedisStore backed by a mock node-redis client whose `multi()` chain and top-level
 * `get()`/`setEx()`/`del()`/`unlink()`/`scanIterator()` calls are individually inspectable/controllable per test.
 */
function createStore(baseKey: string = "store"): {
    store: RedisStore;
    getMock: ReturnType<typeof vi.fn>;
    setExMock: ReturnType<typeof vi.fn>;
    delMock: ReturnType<typeof vi.fn>;
    unlinkMock: ReturnType<typeof vi.fn>;
    scanIteratorMock: ReturnType<typeof vi.fn>;
    multiMock: ReturnType<typeof vi.fn>;
    multiGetMock: ReturnType<typeof vi.fn>;
    multiTtlMock: ReturnType<typeof vi.fn>;
    multiSetExMock: ReturnType<typeof vi.fn>;
    execAsPipelineTypedMock: ReturnType<typeof vi.fn>;
    execAsPipelineMock: ReturnType<typeof vi.fn>;
} {
    const execAsPipelineTypedMock = vi.fn().mockResolvedValue([null, -2]);
    const execAsPipelineMock = vi.fn().mockResolvedValue([]);

    const multiChain: any = {};
    const multiGetMock = vi.fn(() => multiChain);
    const multiTtlMock = vi.fn(() => multiChain);
    const multiSetExMock = vi.fn(() => multiChain);
    multiChain.get = multiGetMock;
    multiChain.ttl = multiTtlMock;
    multiChain.setEx = multiSetExMock;
    multiChain.execAsPipelineTyped = execAsPipelineTypedMock;
    multiChain.execAsPipeline = execAsPipelineMock;

    const multiMock = vi.fn(() => multiChain);
    const getMock = vi.fn().mockResolvedValue(null);
    const setExMock = vi.fn().mockResolvedValue("OK");
    const delMock = vi.fn().mockResolvedValue(1);
    const unlinkMock = vi.fn().mockResolvedValue(1);
    const scanIteratorMock = vi.fn(() => scanPages());

    const client = {
        multi: multiMock,
        get: getMock,
        setEx: setExMock,
        del: delMock,
        unlink: unlinkMock,
        scanIterator: scanIteratorMock,
    } as unknown as RedisClientType;

    const store = new RedisStore(baseKey, client);
    return {
        store,
        getMock,
        setExMock,
        delMock,
        unlinkMock,
        scanIteratorMock,
        multiMock,
        multiGetMock,
        multiTtlMock,
        multiSetExMock,
        execAsPipelineTypedMock,
        execAsPipelineMock,
    };
}

describe("RedisStore Tests", () => {
    let store: RedisStore | undefined;

    afterEach(() => {
        store?.destroy();
        store = undefined;
        vi.useRealTimers();
    });

    describe("constructor", () => {
        it("Initializes with the expected default TTL, max size and base key.", () => {
            ({ store } = createStore());
            expect(store.defaultTTL).toBe(60);
            expect(store.maxSize).toBe(10000);
            expect(store.baseKey).toBe("store");
        });

        it("Defaults the base key to 'store' when none is given.", () => {
            store = new RedisStore();
            expect(store.baseKey).toBe("store.");
        });

        it("Uses a custom base key when provided.", () => {
            ({ store } = createStore("myapp:"));
            expect(store.baseKey).toBe("myapp:");
        });
    });

    describe("without a redis client (in-memory only mode)", () => {
        it("Constructs without throwing when no client is given.", () => {
            store = new RedisStore();
            expect(store.defaultTTL).toBe(60);
            expect(store.maxSize).toBe(10000);
        });

        it("Returns undefined for an id that was never saved, without attempting to contact redis.", async () => {
            store = new RedisStore();
            await expect(store.load("missing")).resolves.toBeUndefined();
        });

        it("save() then load() round-trips purely through the local map.", async () => {
            store = new RedisStore();
            await store.save("id1", { foo: 1 });
            await expect(store.load("id1")).resolves.toEqual({ foo: 1 });
        });

        it("saveMany() then loadMany() round-trips purely through the local map.", async () => {
            store = new RedisStore();
            await store.saveMany(["id1", "id2"], [{ n: 1 }, { n: 2 }]);
            await expect(store.loadMany(["id1", "id2", "missing"])).resolves.toEqual([{ n: 1 }, { n: 2 }, undefined]);
        });

        it("saveSet() then loadSet() round-trips purely through the local map.", async () => {
            store = new RedisStore();
            await store.saveSet("set1", [
                { uid: "a", n: 1 },
                { uid: "b", n: 2 },
            ]);
            await expect(store.loadSet("set1")).resolves.toEqual([
                { uid: "a", n: 1 },
                { uid: "b", n: 2 },
            ]);
        });

        it("clear() empties the local map without throwing.", async () => {
            store = new RedisStore();
            await store.save("id1", { n: 1 });
            await store.clear();
            await expect(store.load("id1")).resolves.toBeUndefined();
        });

        it("deleteMany()/deleteSet() work without throwing.", async () => {
            store = new RedisStore();
            await store.saveMany(["id1"], [{ n: 1 }]);
            await store.deleteMany(["id1"]);
            await expect(store.load("id1")).resolves.toBeUndefined();

            await store.saveSet("set1", [{ uid: "a", n: 1 }]);
            await store.deleteSet("set1");
            await expect(store.loadSet("set1")).resolves.toBeUndefined();
        });

        it("Treats an expired local entry as a real miss (there is no redis to fall back to).", async () => {
            vi.useFakeTimers();
            store = new RedisStore();
            await store.save("id1", { foo: 1 }, 1);

            vi.advanceTimersByTime(1001);

            await expect(store.load("id1")).resolves.toBeUndefined();
        });

        it("delete() removes the local entry without throwing.", async () => {
            store = new RedisStore();
            await store.save("id1", { foo: 1 });

            await expect(store.delete("id1")).resolves.toBeUndefined();
            await expect(store.load("id1")).resolves.toBeUndefined();
        });

        it("Still evicts the oldest entry once at maxSize.", async () => {
            store = new RedisStore();
            store.maxSize = 2;

            await store.save("id1", { n: 1 });
            await store.save("id2", { n: 2 });
            await store.save("id3", { n: 3 });

            expect((store as any).entries.size).toBe(2);
            await expect(store.load("id1")).resolves.toBeUndefined();
        });

        it("Still runs the background sweep to reclaim expired entries.", async () => {
            vi.useFakeTimers();
            store = new RedisStore();

            await store.save("expired", { n: 1 }, 1);
            await store.save("alive", { n: 2 }, 120);

            vi.advanceTimersByTime(1001);
            vi.advanceTimersByTime(60_000);

            expect((store as any).entries.has("store.expired")).toBe(false);
            expect((store as any).entries.has("store.alive")).toBe(true);
        });
    });

    describe("load", () => {
        it("Returns undefined for an id that has never been saved and isn't in redis.", async () => {
            let execAsPipelineTypedMock: ReturnType<typeof vi.fn>;
            ({ store, execAsPipelineTypedMock } = createStore());
            execAsPipelineTypedMock.mockResolvedValue([null, -2]);

            await expect(store.load("missing")).resolves.toBeUndefined();
        });

        it("Prepends the base key before checking redis.", async () => {
            let multiGetMock: ReturnType<typeof vi.fn>;
            let multiTtlMock: ReturnType<typeof vi.fn>;
            ({ store, multiGetMock, multiTtlMock } = createStore("myapp:"));

            await store.load("id1");

            expect(multiGetMock).toHaveBeenCalledWith("myapp:id1");
            expect(multiTtlMock).toHaveBeenCalledWith("myapp:id1");
        });

        it("Returns the stored data for a valid, non-expired local entry without contacting redis.", async () => {
            let execAsPipelineTypedMock: ReturnType<typeof vi.fn>;
            let setExMock: ReturnType<typeof vi.fn>;
            ({ store, execAsPipelineTypedMock, setExMock } = createStore());

            await store.save("id1", { foo: 1 });
            expect(setExMock).toHaveBeenCalledTimes(1);

            await expect(store.load("id1")).resolves.toEqual({ foo: 1 });
            // The local copy is fresh, so load() must not need to touch redis at all.
            expect(execAsPipelineTypedMock).not.toHaveBeenCalled();
        });

        it("Falls back to redis on a local cache miss, caching the result locally.", async () => {
            let execAsPipelineTypedMock: ReturnType<typeof vi.fn>;
            ({ store, execAsPipelineTypedMock } = createStore());
            execAsPipelineTypedMock.mockResolvedValue([JSON.stringify({ foo: 2 }), 120]);

            await expect(store.load("id1")).resolves.toEqual({ foo: 2 });
            expect((store as any).entries.get("storeid1")).toEqual({
                data: { foo: 2 },
                expiresAt: expect.any(Number),
            });
        });

        it("Returns undefined when redis has no record for the id (GET returns null).", async () => {
            let execAsPipelineTypedMock: ReturnType<typeof vi.fn>;
            ({ store, execAsPipelineTypedMock } = createStore());
            execAsPipelineTypedMock.mockResolvedValue([null, -2]);

            await expect(store.load("missing")).resolves.toBeUndefined();
            expect((store as any).entries.has("storemissing")).toBe(false);
        });

        it("Skips redis entirely when skipRedis is true, reporting a local miss as undefined.", async () => {
            let execAsPipelineTypedMock: ReturnType<typeof vi.fn>;
            ({ store, execAsPipelineTypedMock } = createStore());

            await expect(store.load("id1", true)).resolves.toBeUndefined();
            expect(execAsPipelineTypedMock).not.toHaveBeenCalled();
        });

        it("Treats a falsy (empty-string) GET reply the same as a miss.", async () => {
            let execAsPipelineTypedMock: ReturnType<typeof vi.fn>;
            ({ store, execAsPipelineTypedMock } = createStore());
            execAsPipelineTypedMock.mockResolvedValue(["", 60]);

            await expect(store.load("id1")).resolves.toBeUndefined();
            expect((store as any).entries.has("storeid1")).toBe(false);
        });

        it(
            "Re-checks redis once the local copy has expired, instead of reporting not-found from stale local " +
                "state (another process may have renewed the entry with a longer TTL in the interim).",
            async () => {
                let execAsPipelineTypedMock: ReturnType<typeof vi.fn>;
                vi.useFakeTimers();
                ({ store, execAsPipelineTypedMock } = createStore());

                await store.save("id1", { foo: 1 }, 1);
                vi.advanceTimersByTime(1001);

                // Simulate another process having renewed the key in redis with fresh data/TTL before our local
                // copy's (now-expired) clock caught up.
                execAsPipelineTypedMock.mockResolvedValue([JSON.stringify({ foo: 99 }), 120]);

                await expect(store.load("id1")).resolves.toEqual({ foo: 99 });
                expect(execAsPipelineTypedMock).toHaveBeenCalledTimes(1);
            },
        );

        it("Evicts the oldest local entry once load()'s redis-fallback path would exceed maxSize.", async () => {
            let execAsPipelineTypedMock: ReturnType<typeof vi.fn>;
            ({ store, execAsPipelineTypedMock } = createStore());
            store.maxSize = 2;

            execAsPipelineTypedMock.mockResolvedValueOnce([JSON.stringify({ n: 1 }), 60]);
            await store.load("id1");

            execAsPipelineTypedMock.mockResolvedValueOnce([JSON.stringify({ n: 2 }), 60]);
            await store.load("id2");
            expect((store as any).entries.size).toBe(2);

            // A third distinct id, fetched from redis, should evict the oldest (id1) rather than growing past
            // maxSize.
            execAsPipelineTypedMock.mockResolvedValueOnce([JSON.stringify({ n: 3 }), 60]);
            await store.load("id3");

            expect((store as any).entries.size).toBe(2);
            expect((store as any).entries.has("storeid1")).toBe(false);
            expect((store as any).entries.has("storeid2")).toBe(true);
            expect((store as any).entries.has("storeid3")).toBe(true);
        });

        it("Reclaims already-expired local entries before evicting a live one, on the redis-fallback path.", async () => {
            let execAsPipelineTypedMock: ReturnType<typeof vi.fn>;
            vi.useFakeTimers();
            ({ store, execAsPipelineTypedMock } = createStore());
            store.maxSize = 2;

            await store.save("expired", { n: 1 }, 1);
            await store.save("alive", { n: 2 }, 120);
            vi.advanceTimersByTime(1001);

            execAsPipelineTypedMock.mockResolvedValueOnce([JSON.stringify({ n: 3 }), 60]);
            await store.load("id3");

            expect((store as any).entries.size).toBe(2);
            expect((store as any).entries.has("storeexpired")).toBe(false);
            expect((store as any).entries.has("storealive")).toBe(true);
            expect((store as any).entries.has("storeid3")).toBe(true);
        });
    });

    describe("loadMany", () => {
        it("Returns an empty array for an empty id list.", async () => {
            ({ store } = createStore());
            await expect(store.loadMany([])).resolves.toEqual([]);
        });

        it("Serves ids already present in the local map without contacting redis.", async () => {
            let execAsPipelineMock: ReturnType<typeof vi.fn>;
            ({ store, execAsPipelineMock } = createStore());

            await store.save("id1", { n: 1 });
            await store.save("id2", { n: 2 });

            await expect(store.loadMany(["id1", "id2"])).resolves.toEqual([{ n: 1 }, { n: 2 }]);
            expect(execAsPipelineMock).not.toHaveBeenCalled();
        });

        it("Fetches missing ids from redis via a single pipelined call, preserving requested order.", async () => {
            let execAsPipelineMock: ReturnType<typeof vi.fn>;
            let multiGetMock: ReturnType<typeof vi.fn>;
            ({ store, execAsPipelineMock, multiGetMock } = createStore("myapp:"));

            await store.save("id2", { n: 2 });
            execAsPipelineMock.mockResolvedValue([JSON.stringify({ n: 1 }), 60, JSON.stringify({ n: 3 }), 60]);

            const result = await store.loadMany(["id1", "id2", "id3"]);

            expect(result).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
            expect(execAsPipelineMock).toHaveBeenCalledTimes(1);
            expect(multiGetMock).toHaveBeenCalledWith("myapp:id1");
            expect(multiGetMock).toHaveBeenCalledWith("myapp:id3");
            expect(multiGetMock).not.toHaveBeenCalledWith("myapp:id2");
        });

        it("Leaves a slot undefined when redis has no record for that id.", async () => {
            let execAsPipelineMock: ReturnType<typeof vi.fn>;
            ({ store, execAsPipelineMock } = createStore());
            execAsPipelineMock.mockResolvedValue([null, -2]);

            await expect(store.loadMany(["missing"])).resolves.toEqual([undefined]);
        });

        it("Caches ids fetched from redis locally so a later load() doesn't need to hit redis again.", async () => {
            let execAsPipelineMock: ReturnType<typeof vi.fn>;
            let execAsPipelineTypedMock: ReturnType<typeof vi.fn>;
            ({ store, execAsPipelineMock, execAsPipelineTypedMock } = createStore());
            execAsPipelineMock.mockResolvedValue([JSON.stringify({ n: 1 }), 60]);

            await store.loadMany(["id1"]);

            await expect(store.load("id1")).resolves.toEqual({ n: 1 });
            expect(execAsPipelineTypedMock).not.toHaveBeenCalled();
        });

        it("Returns per-id undefined slots (without contacting redis) when there is no client.", async () => {
            store = new RedisStore();
            await expect(store.loadMany(["missing"])).resolves.toEqual([undefined]);
        });

        it("Evicts exactly enough of the oldest local entries for the fetched batch to fit maxSize.", async () => {
            let execAsPipelineMock: ReturnType<typeof vi.fn>;
            ({ store, execAsPipelineMock } = createStore());
            store.maxSize = 2;

            await store.save("id1", { n: 1 });
            expect((store as any).entries.size).toBe(1);

            execAsPipelineMock.mockResolvedValue([JSON.stringify({ n: 2 }), 60, JSON.stringify({ n: 3 }), 60]);
            await store.loadMany(["id2", "id3"]);

            // id1 was the sole oldest entry; the batch of 2 new ids needed exactly 1 eviction to fit.
            expect((store as any).entries.size).toBe(2);
            expect((store as any).entries.has("storeid1")).toBe(false);
            expect((store as any).entries.has("storeid2")).toBe(true);
            expect((store as any).entries.has("storeid3")).toBe(true);
        });

        it("Evicts nothing further when sweeping expired entries alone already made room for the fetched batch.", async () => {
            let execAsPipelineMock: ReturnType<typeof vi.fn>;
            vi.useFakeTimers();
            ({ store, execAsPipelineMock } = createStore());
            store.maxSize = 2;

            await store.save("expired", { n: 1 }, 1);
            vi.advanceTimersByTime(1001);

            execAsPipelineMock.mockResolvedValue([JSON.stringify({ n: 2 }), 60, JSON.stringify({ n: 3 }), 60]);
            await store.loadMany(["id2", "id3"]);

            // Sweeping "expired" alone freed exactly enough room for the batch of 2 — no live entry needed eviction.
            expect((store as any).entries.size).toBe(2);
            expect((store as any).entries.has("storeid2")).toBe(true);
            expect((store as any).entries.has("storeid3")).toBe(true);
        });

        it("Stays at maxSize even when the fetched batch alone is larger than maxSize.", async () => {
            let execAsPipelineMock: ReturnType<typeof vi.fn>;
            ({ store, execAsPipelineMock } = createStore());
            store.maxSize = 2;

            const ids = ["a", "b", "c", "d", "e"];
            const pipelineResult: any[] = [];
            for (const id of ids) {
                pipelineResult.push(JSON.stringify({ id }), 60);
            }
            execAsPipelineMock.mockResolvedValue(pipelineResult);

            const result = await store.loadMany(ids);

            // Every id was still resolved from redis and returned to the caller...
            expect(result).toEqual(ids.map((id) => ({ id })));
            // ...but the local cache must not be left holding more than maxSize entries just because a single
            // batch happened to be larger than the cap.
            expect((store as any).entries.size).toBeLessThanOrEqual(2);
        });
    });

    describe("loadSet", () => {
        it("Returns undefined when the set has never been saved and there is no client.", async () => {
            store = new RedisStore();
            await expect(store.loadSet("missing")).resolves.toBeUndefined();
        });

        it("Returns undefined when the set has never been saved and redis has no record either.", async () => {
            let getMock: ReturnType<typeof vi.fn>;
            ({ store, getMock } = createStore());
            getMock.mockResolvedValue(null);

            await expect(store.loadSet("missing")).resolves.toBeUndefined();
        });

        it("Serves from the local set cache without contacting redis's top-level GET.", async () => {
            let getMock: ReturnType<typeof vi.fn>;
            let execAsPipelineMock: ReturnType<typeof vi.fn>;
            ({ store, getMock, execAsPipelineMock } = createStore());
            execAsPipelineMock.mockResolvedValue([JSON.stringify({ uid: "a", n: 1 }), 60]);

            await store.saveSet("set1", [{ uid: "a", n: 1 }]);
            await expect(store.loadSet("set1")).resolves.toEqual([{ uid: "a", n: 1 }]);
            expect(getMock).not.toHaveBeenCalled();
        });

        it("Falls back to redis for the id list on a local cache miss, then caches it locally.", async () => {
            let multiGetMock: ReturnType<typeof vi.fn>;
            let multiTtlMock: ReturnType<typeof vi.fn>;
            let execAsPipelineTypedMock: ReturnType<typeof vi.fn>;
            let execAsPipelineMock: ReturnType<typeof vi.fn>;
            ({ store, multiGetMock, multiTtlMock, execAsPipelineTypedMock, execAsPipelineMock } =
                createStore("myapp:"));
            execAsPipelineTypedMock.mockResolvedValueOnce([JSON.stringify(["a", "b"]), 60]);
            execAsPipelineMock.mockResolvedValue([
                JSON.stringify({ uid: "a", n: 1 }),
                60,
                JSON.stringify({ uid: "b", n: 2 }),
                60,
            ]);

            const result = await store.loadSet("set1");

            expect(multiGetMock).toHaveBeenCalledWith("myapp:set1");
            expect(multiTtlMock).toHaveBeenCalledWith("myapp:set1");
            expect(result).toEqual([
                { uid: "a", n: 1 },
                { uid: "b", n: 2 },
            ]);
            expect((store as any).sets.get("myapp:set1")).toEqual({ ids: ["a", "b"], expiresAt: expect.any(Number) });

            // A second call should now be served from the local set cache.
            execAsPipelineTypedMock.mockClear();
            await store.loadSet("set1");
            expect(execAsPipelineTypedMock).not.toHaveBeenCalled();
        });

        it("Re-fetches from redis once the locally-cached set has expired, instead of serving it forever.", async () => {
            let execAsPipelineTypedMock: ReturnType<typeof vi.fn>;
            let execAsPipelineMock: ReturnType<typeof vi.fn>;
            vi.useFakeTimers();
            ({ store, execAsPipelineTypedMock, execAsPipelineMock } = createStore("myapp:"));
            execAsPipelineTypedMock.mockResolvedValueOnce([JSON.stringify(["a"]), 1]);
            execAsPipelineMock.mockResolvedValue([JSON.stringify({ uid: "a", n: 1 }), 1]);

            await store.loadSet("set1");
            vi.advanceTimersByTime(1001);

            execAsPipelineTypedMock.mockClear();
            execAsPipelineTypedMock.mockResolvedValueOnce([JSON.stringify(["a", "b"]), 60]);
            execAsPipelineMock.mockResolvedValue([
                JSON.stringify({ uid: "a", n: 1 }),
                60,
                JSON.stringify({ uid: "b", n: 2 }),
                60,
            ]);

            const result = await store.loadSet("set1");

            expect(execAsPipelineTypedMock).toHaveBeenCalled();
            expect(result).toEqual([
                { uid: "a", n: 1 },
                { uid: "b", n: 2 },
            ]);
        });
    });

    describe("save", () => {
        it("Persists to redis via setEx with the correct argument order (key, seconds, value).", async () => {
            let setExMock: ReturnType<typeof vi.fn>;
            ({ store, setExMock } = createStore());

            await store.save("id1", { foo: 1 }, 5);

            expect(setExMock).toHaveBeenCalledWith("storeid1", 5, JSON.stringify({ foo: 1 }));
        });

        it("Prepends the base key to the id.", async () => {
            let setExMock: ReturnType<typeof vi.fn>;
            ({ store, setExMock } = createStore("myapp:"));

            await store.save("id1", { foo: 1 });

            expect(setExMock).toHaveBeenCalledWith("myapp:id1", expect.any(Number), expect.any(String));
            expect((store as any).entries.has("myapp:id1")).toBe(true);
        });

        it("Percent-encodes the id so a colon in it cannot spoof a different baseKey's namespace.", async () => {
            let setExMock: ReturnType<typeof vi.fn>;
            ({ store, setExMock } = createStore("user:"));

            // A caller-supplied id of "session:target" must not produce the literal key "user:session:target",
            // which would collide with a second store constructed as `new RedisStore("user:session:", client)`.
            await store.save("session:target", { role: "admin" });

            expect(setExMock).toHaveBeenCalledWith(
                "user:session%3Atarget",
                expect.any(Number),
                JSON.stringify({ role: "admin" }),
            );
            expect((store as any).entries.has("user:session:target")).toBe(false);
            expect((store as any).entries.has("user:session%3Atarget")).toBe(true);
        });

        it("Skips writing to redis when skipRedis is true, but still updates the local cache.", async () => {
            let setExMock: ReturnType<typeof vi.fn>;
            ({ store, setExMock } = createStore());

            await store.save("id1", { foo: 1 }, 60, true);

            expect(setExMock).not.toHaveBeenCalled();
            await expect(store.load("id1")).resolves.toEqual({ foo: 1 });
        });

        it("Falls back to defaultTTL when no ttl is provided.", async () => {
            let setExMock: ReturnType<typeof vi.fn>;
            vi.useFakeTimers();
            const now = Date.now();
            ({ store, setExMock } = createStore());

            await store.save("id1", { foo: 1 });

            expect(setExMock).toHaveBeenCalledWith("storeid1", store.defaultTTL, JSON.stringify({ foo: 1 }));
            const entry = (store as any).entries.get("storeid1");
            expect(entry.expiresAt).toBe(now + store.defaultTTL * 1000);
        });

        it("Uses the given ttl when provided.", async () => {
            vi.useFakeTimers();
            const now = Date.now();
            ({ store } = createStore());

            await store.save("id1", { foo: 1 }, 5);

            const entry = (store as any).entries.get("storeid1");
            expect(entry.expiresAt).toBe(now + 5000);
        });

        it("Stores the exact data object reference locally, without cloning.", async () => {
            ({ store } = createStore());
            const data = { foo: 1 };

            await store.save("id1", data);

            expect((store as any).entries.get("storeid1").data).toBe(data);
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
            expect((store as any).entries.has("storeid1")).toBe(false);
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
            expect((store as any).entries.has("storealive")).toBe(true);
            expect((store as any).entries.has("storeid3")).toBe(true);
        });

        it("Overwriting an existing id at capacity does not evict anything.", async () => {
            ({ store } = createStore());
            store.maxSize = 2;

            await store.save("id1", { n: 1 });
            await store.save("id2", { n: 2 });
            await store.save("id1", { n: 99 });

            expect((store as any).entries.size).toBe(2);
            expect((store as any).entries.has("storeid2")).toBe(true);
        });

        it(
            "Leaves the local cache untouched when the redis write fails, instead of reporting a value as saved " +
                "that never made it to the shared store.",
            async () => {
                let setExMock: ReturnType<typeof vi.fn>;
                ({ store, setExMock } = createStore());
                setExMock.mockRejectedValue(new Error("connection lost"));

                await expect(store.save("id1", { foo: 1 })).rejects.toThrow("connection lost");
                expect((store as any).entries.has("storeid1")).toBe(false);
            },
        );

        it("Does not evict an existing entry from the local map when a redis write fails for a new id.", async () => {
            let setExMock: ReturnType<typeof vi.fn>;
            ({ store, setExMock } = createStore());
            store.maxSize = 1;

            await store.save("id1", { n: 1 });

            setExMock.mockRejectedValueOnce(new Error("connection lost"));
            await expect(store.save("id2", { n: 2 })).rejects.toThrow("connection lost");

            expect((store as any).entries.size).toBe(1);
            expect((store as any).entries.has("storeid1")).toBe(true);
        });
    });

    describe("saveMany", () => {
        it("Throws when ids and data have different lengths.", async () => {
            ({ store } = createStore());
            await expect(store.saveMany(["id1"], [{ n: 1 }, { n: 2 }])).rejects.toThrow(
                "The ids and data arguments must have the same length.",
            );
        });

        it("Does nothing (and does not throw) for empty ids/data arrays.", async () => {
            let execAsPipelineMock: ReturnType<typeof vi.fn>;
            ({ store, execAsPipelineMock } = createStore());
            await expect(store.saveMany([], [])).resolves.toBeUndefined();
            expect(execAsPipelineMock).toHaveBeenCalledTimes(1);
        });

        it("Writes every record to redis via a single pipelined call, with the base key prepended.", async () => {
            let execAsPipelineMock: ReturnType<typeof vi.fn>;
            let multiSetExMock: ReturnType<typeof vi.fn>;
            ({ store, execAsPipelineMock, multiSetExMock } = createStore("myapp:"));

            await store.saveMany(["id1", "id2"], [{ n: 1 }, { n: 2 }], 30);

            expect(execAsPipelineMock).toHaveBeenCalledTimes(1);
            expect(multiSetExMock).toHaveBeenCalledWith("myapp:id1", 30, JSON.stringify({ n: 1 }));
            expect(multiSetExMock).toHaveBeenCalledWith("myapp:id2", 30, JSON.stringify({ n: 2 }));
        });

        it("Updates the local map for every id after a successful write.", async () => {
            ({ store } = createStore());

            await store.saveMany(["id1", "id2"], [{ n: 1 }, { n: 2 }]);

            await expect(store.load("id1")).resolves.toEqual({ n: 1 });
            await expect(store.load("id2")).resolves.toEqual({ n: 2 });
        });

        it("Works without a redis client, updating only the local map.", async () => {
            store = new RedisStore();
            await store.saveMany(["id1", "id2"], [{ n: 1 }, { n: 2 }]);
            await expect(store.load("id1")).resolves.toEqual({ n: 1 });
            await expect(store.load("id2")).resolves.toEqual({ n: 2 });
        });

        it("Evicts exactly enough of the oldest entries for a new batch to fit maxSize.", async () => {
            ({ store } = createStore());
            store.maxSize = 3;

            await store.save("id1", { n: 1 });
            await store.save("id2", { n: 2 });
            await store.save("id3", { n: 3 });
            expect((store as any).entries.size).toBe(3);

            // Two brand-new ids at capacity should evict exactly the two oldest (id1, id2).
            await store.saveMany(["id4", "id5"], [{ n: 4 }, { n: 5 }]);

            expect((store as any).entries.size).toBe(3);
            expect((store as any).entries.has("storeid1")).toBe(false);
            expect((store as any).entries.has("storeid2")).toBe(false);
            expect((store as any).entries.has("storeid3")).toBe(true);
            expect((store as any).entries.has("storeid4")).toBe(true);
            expect((store as any).entries.has("storeid5")).toBe(true);
        });

        it("Does not evict anything when the whole batch is just renewing ids already cached.", async () => {
            ({ store } = createStore());
            store.maxSize = 2;

            await store.save("id1", { n: 1 });
            await store.save("id2", { n: 2 });

            // Re-saving the same two ids as a batch must not count as 2 new entries and evict anything.
            await store.saveMany(["id1", "id2"], [{ n: 11 }, { n: 22 }]);

            expect((store as any).entries.size).toBe(2);
            await expect(store.load("id1")).resolves.toEqual({ n: 11 });
            await expect(store.load("id2")).resolves.toEqual({ n: 22 });
        });

        it("Reclaims already-expired entries before evicting a live one for the incoming batch.", async () => {
            vi.useFakeTimers();
            ({ store } = createStore());
            store.maxSize = 2;

            await store.save("expired", { n: 1 }, 1);
            await store.save("alive", { n: 2 }, 120);
            vi.advanceTimersByTime(1001);

            await store.saveMany(["id3"], [{ n: 3 }]);

            expect((store as any).entries.size).toBe(2);
            expect((store as any).entries.has("storealive")).toBe(true);
            expect((store as any).entries.has("storeid3")).toBe(true);
        });

        it("Correctly counts new vs. already-cached ids when re-checking room after a sweep.", async () => {
            ({ store } = createStore());
            store.maxSize = 3;

            await store.save("id1", { n: 1 });
            await store.save("id2", { n: 2 });
            await store.save("id3", { n: 3 });
            expect((store as any).entries.size).toBe(3);

            // At capacity, with no expired entries to sweep: a batch mixing one already-cached id (id1) with one
            // genuinely new id (id4) must only evict for the single new id, not for both.
            await store.saveMany(["id1", "id4"], [{ n: 11 }, { n: 4 }]);

            expect((store as any).entries.size).toBe(3);
            expect((store as any).entries.has("storeid2")).toBe(false);
            expect((store as any).entries.has("storeid1")).toBe(true);
            expect((store as any).entries.has("storeid3")).toBe(true);
            expect((store as any).entries.has("storeid4")).toBe(true);
        });
    });

    describe("saveSet", () => {
        it("Stores each record individually and the id list as a set, retrievable via loadSet.", async () => {
            let multiSetExMock: ReturnType<typeof vi.fn>;
            let setExMock: ReturnType<typeof vi.fn>;
            let execAsPipelineMock: ReturnType<typeof vi.fn>;
            ({ store, multiSetExMock, setExMock, execAsPipelineMock } = createStore("myapp:"));

            const data = [
                { uid: "a", n: 1 },
                { uid: "b", n: 2 },
            ];
            await store.saveSet("set1", data, "uid", 30);

            expect(multiSetExMock).toHaveBeenCalledWith("myapp:a", 30, JSON.stringify({ uid: "a", n: 1 }));
            expect(multiSetExMock).toHaveBeenCalledWith("myapp:b", 30, JSON.stringify({ uid: "b", n: 2 }));
            expect(setExMock).toHaveBeenCalledWith("myapp:set1", 30, JSON.stringify(["a", "b"]));

            // The local `sets` cache must hold the raw id list (not the full records), matching what loadSet()'s
            // local-cache fast path (and the redis fallback path) both expect to find there.
            expect((store as any).sets.get("myapp:set1")).toEqual({ ids: ["a", "b"], expiresAt: expect.any(Number) });

            execAsPipelineMock.mockResolvedValue([JSON.stringify(data[0]), 30, JSON.stringify(data[1]), 30]);
            await expect(store.loadSet("set1")).resolves.toEqual(data);
        });

        it("Skips records whose idProp is missing, without letting them collide with one another.", async () => {
            let multiSetExMock: ReturnType<typeof vi.fn>;
            ({ store, multiSetExMock } = createStore());

            await store.saveSet("set1", [{ uid: "a", n: 1 }, { n: 2 }, { n: 3 }]);

            expect(multiSetExMock).toHaveBeenCalledTimes(1);
            expect(multiSetExMock).toHaveBeenCalledWith("storea", 60, JSON.stringify({ uid: "a", n: 1 }));
            expect((store as any).sets.get("storeset1")).toEqual({ ids: ["a"], expiresAt: expect.any(Number) });
        });

        it("Keeps a record whose idProp is falsy-but-valid (e.g. 0).", async () => {
            let multiSetExMock: ReturnType<typeof vi.fn>;
            ({ store, multiSetExMock } = createStore());

            await store.saveSet("set1", [{ uid: 0, n: 1 }]);

            expect(multiSetExMock).toHaveBeenCalledWith("store0", 60, JSON.stringify({ uid: 0, n: 1 }));
            expect((store as any).sets.get("storeset1")).toEqual({ ids: [0], expiresAt: expect.any(Number) });
        });

        it("Uses a custom idProp when provided.", async () => {
            let multiSetExMock: ReturnType<typeof vi.fn>;
            ({ store, multiSetExMock } = createStore());

            await store.saveSet("set1", [{ id: "x", n: 1 }], "id");

            expect(multiSetExMock).toHaveBeenCalledWith("storex", 60, JSON.stringify({ id: "x", n: 1 }));
        });

        it("Still records an (empty) set when every record lacks the idProp.", async () => {
            ({ store } = createStore());

            await store.saveSet("set1", [{ n: 1 }]);

            await expect(store.loadSet("set1")).resolves.toEqual([]);
        });

        it("Works without a redis client, updating only the local maps.", async () => {
            store = new RedisStore();
            await store.saveSet("set1", [{ uid: "a", n: 1 }]);
            await expect(store.loadSet("set1")).resolves.toEqual([{ uid: "a", n: 1 }]);
        });

        it("Evicts the single oldest set once the local set cache is at maxSize, without touching the others.", async () => {
            store = new RedisStore();
            store.maxSize = 2;

            await store.saveSet("set1", [{ uid: "a", n: 1 }]);
            await store.saveSet("set2", [{ uid: "b", n: 2 }]);
            expect((store as any).sets.size).toBe(2);

            await store.saveSet("set3", [{ uid: "c", n: 3 }]);
            expect((store as any).sets.size).toBe(2);
            expect((store as any).sets.has("store.set1")).toBe(false);
            expect((store as any).sets.has("store.set3")).toBe(true);
        });

        it("Percent-encodes the id so it cannot spoof a different baseKey's namespace.", async () => {
            let setExMock: ReturnType<typeof vi.fn>;
            let multiSetExMock: ReturnType<typeof vi.fn>;
            ({ store, setExMock, multiSetExMock } = createStore("user:"));

            // Without encoding, `"user:" + "session:target"` would collide with a second store's
            // `new RedisStore("user:session:", client)` namespace.
            await store.saveSet("session:target", [{ uid: "a", n: 1 }]);

            expect(setExMock).toHaveBeenCalledWith("user:session%3Atarget", 60, JSON.stringify(["a"]));
            expect(multiSetExMock).toHaveBeenCalledWith("user:a", 60, JSON.stringify({ uid: "a", n: 1 }));
        });
    });

    describe("delete", () => {
        it("Removes an existing local entry and issues a redis DEL with the base key prepended.", async () => {
            let delMock: ReturnType<typeof vi.fn>;
            ({ store, delMock } = createStore("myapp:"));

            await store.save("id1", { foo: 1 });
            await store.delete("id1");

            expect(delMock).toHaveBeenCalledWith("myapp:id1");
            expect((store as any).entries.has("myapp:id1")).toBe(false);
        });

        it("Does not throw when deleting an id that was never saved locally.", async () => {
            let delMock: ReturnType<typeof vi.fn>;
            ({ store, delMock } = createStore());

            await expect(store.delete("missing")).resolves.toBeUndefined();
            expect(delMock).toHaveBeenCalledWith("storemissing");
        });
    });

    describe("deleteMany", () => {
        it("Does nothing and does not call redis for an empty id list.", async () => {
            let delMock: ReturnType<typeof vi.fn>;
            ({ store, delMock } = createStore());

            await expect(store.deleteMany([])).resolves.toBeUndefined();
            expect(delMock).not.toHaveBeenCalled();
        });

        it("Removes existing local entries and issues a single redis DEL with the base key prepended.", async () => {
            let delMock: ReturnType<typeof vi.fn>;
            ({ store, delMock } = createStore("myapp:"));

            await store.saveMany(["id1", "id2"], [{ n: 1 }, { n: 2 }]);
            await store.deleteMany(["id1", "id2"]);

            expect(delMock).toHaveBeenCalledWith(["myapp:id1", "myapp:id2"]);
            expect((store as any).entries.has("myapp:id1")).toBe(false);
            expect((store as any).entries.has("myapp:id2")).toBe(false);
        });
    });

    describe("deleteSet", () => {
        it("Removes the set's id list but leaves the individually-stored records alone.", async () => {
            let delMock: ReturnType<typeof vi.fn>;
            ({ store, delMock } = createStore("myapp:"));

            await store.saveSet("set1", [{ uid: "a", n: 1 }]);
            await store.deleteSet("set1");

            expect(delMock).toHaveBeenCalledWith("myapp:set1");
            expect((store as any).sets.has("myapp:set1")).toBe(false);
            // The individual record itself is untouched — it will simply expire naturally.
            expect((store as any).entries.has("myapp:a")).toBe(true);
        });
    });

    describe("clear", () => {
        it("Clears the local maps and does nothing further when there is no client.", async () => {
            store = new RedisStore();
            await store.save("id1", { n: 1 });
            await store.saveSet("set1", [{ uid: "a", n: 1 }]);

            await store.clear();

            expect((store as any).entries.size).toBe(0);
            expect((store as any).sets.size).toBe(0);
        });

        it("Scans for keys matching the base key and unlinks them.", async () => {
            let scanIteratorMock: ReturnType<typeof vi.fn>;
            let unlinkMock: ReturnType<typeof vi.fn>;
            ({ store, scanIteratorMock, unlinkMock } = createStore("myapp:"));
            scanIteratorMock.mockReturnValue(scanPages(["myapp:id1", "myapp:id2"], ["myapp:id3"]));

            await store.save("id1", { n: 1 });
            await store.clear();

            expect(scanIteratorMock).toHaveBeenCalledWith({ MATCH: "myapp:*" });
            expect(unlinkMock).toHaveBeenCalledWith(["myapp:id1", "myapp:id2", "myapp:id3"]);
            expect((store as any).entries.size).toBe(0);
        });

        it("Does not call unlink when the scan finds no matching keys.", async () => {
            let scanIteratorMock: ReturnType<typeof vi.fn>;
            let unlinkMock: ReturnType<typeof vi.fn>;
            ({ store, scanIteratorMock, unlinkMock } = createStore());
            scanIteratorMock.mockReturnValue(scanPages());

            await store.clear();

            expect(unlinkMock).not.toHaveBeenCalled();
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

            expect((store as any).entries.has("storeexpired")).toBe(false);
            expect((store as any).entries.has("storealive")).toBe(true);
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

            expect((store as any).entries.has("storeexpired")).toBe(true);
        });
    });
});
