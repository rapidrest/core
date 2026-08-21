///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2026 Jean-Philippe Steinmetz. All rights reserved.
///////////////////////////////////////////////////////////////////////////////
import { CacheUtils } from "./CacheUtils.js";
import { Destroy } from "./decorators/ObjectDecorators.js";
import { MemoryStoreEntry, MemoryStoreSetEntry, SimpleStore } from "./SimpleStore.js";
import type { RedisClientType } from "redis";

/** How often the sweep interval reclaims expired, never-reloaded sessions. */
const SWEEP_INTERVAL_MS = 60_000;

/**
 * Implements a SimpleStore storage system that combines a local in-memory store optionally backed by Redis. When
 * no Redis client is given, the store behaves as a plain in-memory store (equivalent to `MemoryStore`).
 *
 * @author Jean-Philippe Steinmetz
 */
export class RedisStore implements SimpleStore {
    /**
     * The base key that is pre-pended to all IDs.
     */
    public readonly baseKey: string;

    public client?: RedisClientType;

    /** The default record TTL (in seconds). */
    public defaultTTL: number = 60;

    protected entries: Map<string, MemoryStoreEntry> = new Map();

    /** The maximum number of records to store. */
    public maxSize: number = 10000;

    protected sets: Map<string, MemoryStoreSetEntry> = new Map();

    private sweepTimer: ReturnType<typeof setInterval>;

    /**
     * @param baseKey The base key that is pre-pended to all IDs.
     * @param client The Redis client to back this store with. When omitted, the store operates purely in-memory.
     */
    constructor(baseKey: string = "store.", client?: RedisClientType) {
        this.baseKey = baseKey;
        this.client = client;
        this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
        this.sweepTimer.unref?.();
    }

    public async clear(): Promise<void> {
        this.entries.clear();
        this.sets.clear();

        // Delete all entries in redis
        if (this.client) {
            let keys: string[] = [];
            for await (const results of this.client.scanIterator({ MATCH: this.baseKey + "*" })) {
                keys.push(...results);
            }

            if (keys.length > 0) {
                await this.client.unlink(keys);
            }
        }
    }

    public async delete(id: string): Promise<void> {
        // Prepend the base key to the id
        id = this._key(id);

        this.entries.delete(id);
        await this.client?.del(id);
    }

    public async deleteMany(ids: string[]): Promise<void> {
        if (ids.length === 0) {
            return;
        }

        // Pre-pend the baseKey to all ids
        ids = ids.map((id) => this._key(id));

        // Delete all local entries
        for (const id of ids) {
            this.entries.delete(id);
        }

        // Now delete all entries in redis
        await this.client?.del(ids);
    }

    public async deleteSet(id: string): Promise<void> {
        // Prepend the base key to the id
        id = this._key(id);

        // We purposefully don't delete the individually stored records
        // as they may be relevant to other valid queries. Let them expire
        // naturally.
        this.sets.delete(id);
        await this.client?.del(id);
    }

    @Destroy
    public destroy(): void {
        clearInterval(this.sweepTimer);
    }

    /**
     * Builds the Redis/local-cache key for the given id. The id is percent-encoded so that it can never introduce
     * a literal delimiter that spoofs a different `baseKey` namespace - e.g. a client-supplied id of "session:X"
     * concatenated raw onto baseKey "user:" would produce the literal key "user:session:X", colliding with a
     * second store constructed as `new RedisStore("user:session:", client)`. Encoding closes that off since
     * `encodeURIComponent` never leaves a literal ":" (or "/", etc.) in its output.
     */
    private _key(id: string): string {
        return this.baseKey + encodeURIComponent(id);
    }

    public async load(id: string, skipRedis: boolean = false): Promise<Record<string, any> | undefined> {
        // Prepend the base key to the id
        id = this._key(id);

        const entry = this.entries.get(id);
        if (entry) {
            // If the local copy hasn't expired, it's safe to serve directly.
            if (entry.expiresAt > Date.now()) {
                return entry.data;
            }

            // The local copy has expired, but Redis is the source of truth: another process may have renewed
            // the entry (longer TTL) since we cached it here. Drop the stale local copy and fall through to
            // check Redis instead of reporting "not found" based on local state alone.
            this.entries.delete(id);
        }

        // Without a Redis client, this is a pure in-memory store: a local miss/expiry is a real miss.
        if (!this.client || skipRedis) {
            return undefined;
        }

        // The entry wasn't found locally. Try retrieving from redis.
        // We'll also grab the ttl so we can add it to our local map.
        const [data, ttl] = await this.client.multi().get(id).ttl(id).execAsPipelineTyped();
        if (!data) {
            return undefined;
        }

        // Store the entry in our in-memory map for faster retrieval in the future. Bound the local map the same
        // way save() does — otherwise repeated load()s of distinct ids that already exist in Redis (a normal
        // read path) would grow the local map without limit, regardless of maxSize.
        if (!this.entries.has(id) && this.entries.size >= this.maxSize) {
            this.sweep();
            while (this.entries.size >= this.maxSize && this.entries.size > 0) {
                CacheUtils.evictOldest(this.entries);
            }
        }

        const newEntry: MemoryStoreEntry = {
            data: JSON.parse(data),
            expiresAt: Date.now() + ttl * 1000,
        };
        this.entries.set(id, newEntry);

        return newEntry.data;
    }

    public async loadMany(ids: string[]): Promise<(Record<string, any> | undefined)[]> {
        const results: (Record<string, any> | undefined)[] = new Array(ids.length);

        // Load as many from the local store as possible
        let missing: { idx: number; id: string }[] = [];
        for (let idx = 0; idx < ids.length; idx++) {
            const id = ids[idx];
            const result = await this.load(id, true);
            if (result) {
                results[idx] = result;
            } else {
                missing.push({ idx, id });
            }
        }

        if (!this.client) {
            return results;
        }

        // Now load all remaining items from redis. Note that we don't call load() here, instead we use the multi
        // command to reduce the number of times we hit redis (1 call vs n*2 calls).
        if (missing.length > 0) {
            let pipe = this.client.multi();
            for (const pair of missing) {
                const id = this._key(pair.id);
                pipe.get(id).ttl(id);
            }
            const result = await pipe.execAsPipeline();

            let toSave: { id: string; data: Record<string, any>; ttl: number }[] = [];
            for (let i = 0; i < missing.length; i++) {
                const pair = missing[i];
                const data = result[i * 2] as unknown as string | null;
                const ttl = result[i * 2 + 1] as unknown as number;
                if (data) {
                    const record = JSON.parse(data);

                    // Store the result in the same position in our final array
                    results[pair.idx] = record;

                    // Now add the list of items to store locally
                    toSave.push({ id: pair.id, data: record, ttl });
                }
            }

            // Finally go through all items to save.
            if (toSave.length > 0) {
                // Let's do a sweep on the local map and free up space while we're at it. Every id in `toSave` is
                // guaranteed to be a genuinely new key (load() already deleted any expired local copy before
                // reporting a miss), so `toSave.length` is exactly how much the map is about to grow by.
                if (this.entries.size + toSave.length > this.maxSize) {
                    // Reclaim space by sweeping expired entries first, then evicting exactly enough of the oldest
                    // surviving entries for the whole batch to fit — evicting a fixed `toSave.length` regardless
                    // of how much the sweep already freed would evict more live entries than necessary.
                    this.sweep();
                    const overflow = this.entries.size + toSave.length - this.maxSize;
                    if (overflow > 0) {
                        CacheUtils.evictOldest(this.entries, Math.min(overflow, this.entries.size));
                    }
                }

                for (const entry of toSave) {
                    this.entries.set(this._key(entry.id), {
                        data: entry.data,
                        expiresAt: Date.now() + entry.ttl * 1000,
                    });
                }
            }
        }

        return results;
    }

    public async loadSet(id: string): Promise<(Record<string, any> | undefined)[] | undefined> {
        id = this._key(id);

        // First look up the list of ids from local storage
        const entry = this.sets.get(id);
        if (entry) {
            // Same as load(): if the local copy hasn't expired, it's safe to serve directly. Otherwise Redis is
            // the source of truth (another process may have since re-saved this set) - drop the stale local copy
            // and fall through to check Redis instead of serving it forever.
            if (entry.expiresAt > Date.now()) {
                return this.loadMany(entry.ids);
            }
            this.sets.delete(id);
        }

        if (!this.client) {
            return undefined;
        }

        // The set ids aren't stored locally, so let's try redis. Also grab the ttl so the local copy we cache
        // below expires at the same time the Redis-side entry does, instead of being cached forever.
        const [json, ttl] = await this.client.multi().get(id).ttl(id).execAsPipelineTyped();
        if (json) {
            const ids: any[] = JSON.parse(json);

            // Store the list of ids locally for faster retrieval next time, bounded by maxSize the same way
            // entries are - otherwise a caller that varies the set id per request/user/query (a normal loadSet
            // usage pattern) would grow this map without limit.
            if (!this.sets.has(id) && this.sets.size >= this.maxSize) {
                this.sweep();
                while (this.sets.size >= this.maxSize && this.sets.size > 0) {
                    CacheUtils.evictOldest(this.sets);
                }
            }
            this.sets.delete(id);
            this.sets.set(id, { ids, expiresAt: Date.now() + ttl * 1000 });

            return this.loadMany(ids);
        }

        return undefined;
    }

    public async save(
        id: string,
        data: Record<string, any>,
        ttl: number = this.defaultTTL,
        skipRedis: boolean = false,
    ): Promise<void> {
        // Prepend the base key to the id
        id = this._key(id);

        // Write to Redis first (when configured): if it fails (bad connection, etc.), the local cache is left
        // untouched instead of reporting a "saved" value locally that never made it to the shared store other
        // instances read from.
        if (this.client && !skipRedis) {
            await this.client.setEx(id, ttl, JSON.stringify(data));
        }

        if (!this.entries.has(id) && this.entries.size >= this.maxSize) {
            // Reclaim space by sweeping expired entries first, then evicting the oldest surviving entries
            this.sweep();
            while (this.entries.size >= this.maxSize && this.entries.size > 0) {
                CacheUtils.evictOldest(this.entries);
            }
        }

        // Delete before re-inserting so a renewed entry moves to the end of the Map's iteration order. A `Map`
        // does not reorder on `set()` of an already-present key, so without this, an actively-renewed entry stays
        // at its original (oldest) position and `evictOldest()` would evict it ahead of a genuinely idle entry
        // inserted later.
        this.entries.delete(id);
        this.entries.set(id, { data, expiresAt: Date.now() + ttl * 1000 });
    }

    public async saveMany(ids: string[], data: Record<string, any>[], ttl: number = this.defaultTTL): Promise<void> {
        if (ids.length !== data.length) {
            throw new Error("The ids and data arguments must have the same length.");
        }

        // Prepend the base key to each id
        ids = ids.map((id) => this._key(id));

        // Write to Redis first (when configured): if it fails (bad connection, etc.), the local cache is left
        // untouched instead of reporting a "saved" value locally that never made it to the shared store other
        // instances read from.
        if (this.client) {
            // Insert into redis using a pipeline to redis network traffic
            const pipe = this.client.multi();
            for (let i = 0; i < ids.length; i++) {
                const id = ids[i];
                const record = data[i];
                pipe.setEx(id, ttl, JSON.stringify(record));
            }
            await pipe.execAsPipeline();
        }

        // Evict per-id, exactly like save() does, rather than pre-computing a single batch eviction count: a
        // batched "evict N oldest, then insert the batch" approach can evict an entry that is itself one of the
        // ids being (re-)saved in this same batch — that id then gets reinserted right after anyway, so the
        // eviction bought no real space and the map ends up larger than maxSize.
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const record = data[i];

            if (!this.entries.has(id) && this.entries.size >= this.maxSize) {
                // Reclaim space by sweeping expired entries first, then evicting the oldest surviving entries
                this.sweep();
                while (this.entries.size >= this.maxSize && this.entries.size > 0) {
                    CacheUtils.evictOldest(this.entries);
                }
            }

            // Delete before re-inserting so a renewed entry moves to the end of the Map's iteration order. A
            // `Map` does not reorder on `set()` of an already-present key, so without this, an actively-renewed
            // entry stays at its original (oldest) position and `evictOldest()` would evict it ahead of a
            // genuinely idle entry inserted later.
            this.entries.delete(id);
            this.entries.set(id, { data: record, expiresAt: Date.now() + ttl * 1000 });
        }
    }

    public async saveSet(
        id: string,
        data: Record<string, any>[],
        idProp: string = "uid",
        ttl: number = this.defaultTTL,
    ): Promise<void> {
        const ids: any[] = [];
        const records: Record<string, any>[] = [];

        // Create a list of ids that we'll store as a set
        for (const record of data) {
            const recordId: any = record[idProp];
            if (recordId !== undefined && recordId !== null) {
                ids.push(recordId);
                records.push(record);
            }
        }

        // Now store all the records in the cache
        await this.saveMany(ids, records, ttl);

        // Finally, store our set of ids
        const key = this._key(id);
        await this.client?.setEx(key, ttl, JSON.stringify(ids));

        // Bounded by maxSize the same way entries are - see loadSet()/saveSet() comments above for why.
        if (!this.sets.has(key) && this.sets.size >= this.maxSize) {
            this.sweep();
            while (this.sets.size >= this.maxSize && this.sets.size > 0) {
                CacheUtils.evictOldest(this.sets);
            }
        }
        this.sets.delete(key);
        this.sets.set(key, { ids, expiresAt: Date.now() + ttl * 1000 });
    }

    private sweep(): void {
        const now = Date.now();
        for (const [sessionId, entry] of this.entries.entries()) {
            if (entry.expiresAt <= now) this.entries.delete(sessionId);
        }
        for (const [key, entry] of this.sets.entries()) {
            if (entry.expiresAt <= now) this.sets.delete(key);
        }
    }
}
