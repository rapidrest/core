///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2026 Jean-Philippe Steinmetz. All rights reserved.
///////////////////////////////////////////////////////////////////////////////
import { CacheUtils } from "./CacheUtils.js";
import { Destroy } from "./decorators/ObjectDecorators.js";
import { MemoryStoreEntry, SimpleStore } from "./SimpleStore.js";
import type * as ioredis from "ioredis";

/** How often the sweep interval reclaims expired, never-reloaded sessions. */
const SWEEP_INTERVAL_MS = 60_000;

/**
 * Implements a SimpleStore storage system that combines a local in-memory store optionally backed by Redis. When
 * no Redis client is given, the store behaves as a plain in-memory store (equivalent to `MemoryStore`).
 *
 * @author Jean-Philippe Steinmetz
 */
export class RedisStore implements SimpleStore {
    public client?: ioredis.Redis;

    /** The default record TTL (in seconds). */
    public defaultTTL: number = 60;

    protected entries: Map<string, MemoryStoreEntry> = new Map();

    /** The maximum number of records to store. */
    public maxSize: number = 10000;

    private sweepTimer: ReturnType<typeof setInterval>;

    /**
     * @param client The Redis client to back this store with. When omitted, the store operates purely in-memory.
     */
    constructor(client?: ioredis.Redis) {
        this.client = client;
        this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
        this.sweepTimer.unref?.();
    }

    @Destroy
    public destroy(): void {
        clearInterval(this.sweepTimer);
    }

    public async load(id: string): Promise<Record<string, any> | undefined> {
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
        if (!this.client) {
            return undefined;
        }

        // The entry wasn't found locally. Try retrieving from redis.
        // We'll also grab the ttl so we can add it to our local map.
        const result = await this.client
            .multi([
                ["get", id],
                ["ttl", id],
            ])
            .exec();
        if (!result) {
            return undefined;
        }

        const data = result[0][1] ? result[0][1] : undefined;
        const ttl = result[1][1] ?? undefined;
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
            data: JSON.parse(data as string),
            expiresAt: Date.now() + (ttl as number) * 1000,
        };
        this.entries.set(id, newEntry);

        return newEntry.data;
    }

    public async save(id: string, data: Record<string, any>, ttl: number = this.defaultTTL): Promise<void> {
        // Write to Redis first (when configured): if it fails (bad connection, etc.), the local cache is left
        // untouched instead of reporting a "saved" value locally that never made it to the shared store other
        // instances read from.
        if (this.client) {
            await this.client.setex(id, ttl, JSON.stringify(data));
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

    public async delete(id: string): Promise<void> {
        this.entries.delete(id);
        if (this.client) {
            await this.client.del(id);
        }
    }

    private sweep(): void {
        const now = Date.now();
        for (const [sessionId, entry] of this.entries.entries()) {
            if (entry.expiresAt <= now) this.entries.delete(sessionId);
        }
    }
}
