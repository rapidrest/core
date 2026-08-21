///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2026 Jean-Philippe Steinmetz. All rights reserved.
///////////////////////////////////////////////////////////////////////////////
import { CacheUtils } from "./CacheUtils.js";
import { Destroy } from "./decorators/ObjectDecorators.js";
import { MemoryStoreEntry, MemoryStoreSetEntry, SimpleStore } from "./SimpleStore.js";

/** How often the sweep interval reclaims expired, never-reloaded sessions. */
const SWEEP_INTERVAL_MS = 60_000;

/**
 * Implements a SimpleStore storage system that uses a local in-memory storage map.
 *
 * @author Jean-Philippe Steinmetz
 */
export class MemoryStore implements SimpleStore {
    /** The default record TTL (in seconds). */
    public defaultTTL: number = 60;

    protected entries: Map<string, MemoryStoreEntry> = new Map();

    /** The maximum number of records to store. */
    public maxSize: number = 10000;

    protected sets: Map<string, MemoryStoreSetEntry> = new Map();

    private sweepTimer: ReturnType<typeof setInterval>;

    constructor() {
        this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
        this.sweepTimer.unref?.();
    }

    public clear(): void {
        this.entries.clear();
        this.sets.clear();
    }

    public delete(id: string): void {
        this.entries.delete(id);
    }

    public deleteMany(ids: string[]): void {
        for (const id of ids) {
            this.entries.delete(id);
        }
    }

    public deleteSet(id: string): void {
        // We purposefully don't delete the individually stored records
        // as they may be relevant to other valid queries. Let them expire
        // naturally.
        this.sets.delete(id);
    }

    /** Stops the background sweep timer. Call when the owning `SessionManager` is destroyed. */
    @Destroy
    public destroy(): void {
        clearInterval(this.sweepTimer);
    }

    public load(id: string): Record<string, any> | undefined {
        const entry = this.entries.get(id);
        if (!entry) {
            return undefined;
        }

        // If the TTL has expired, remove the entry
        if (entry.expiresAt <= Date.now()) {
            this.entries.delete(id);
            return undefined;
        }

        return entry.data;
    }

    public loadMany(ids: string[]): (Record<string, any> | undefined)[] {
        const results: (Record<string, any> | undefined)[] = [];

        for (const id of ids) {
            results.push(this.load(id));
        }

        return results;
    }

    public loadSet(id: string): (Record<string, any> | undefined)[] | undefined {
        const entry = this.sets.get(id);
        if (!entry) {
            return undefined;
        }

        // Same expiry discipline as load(): a set left past its TTL must not keep being served.
        if (entry.expiresAt <= Date.now()) {
            this.sets.delete(id);
            return undefined;
        }

        return this.loadMany(entry.ids);
    }

    public save(id: string, data: Record<string, any>, ttl: number = this.defaultTTL): void {
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

    saveMany(ids: string[], data: Record<string, any>[], ttl: number = this.defaultTTL): void {
        if (ids.length !== data.length) {
            throw new Error("The ids and data arrays have different lengths.");
        }

        for (let i = 0; i < ids.length; i++) {
            this.save(ids[i], data[i], ttl);
        }
    }

    saveSet(id: string, data: Record<string, any>[], idProp: string = "uid", ttl: number = this.defaultTTL): void {
        // Extract the list of ids from the data set, skipping any record that has no idProp value — otherwise
        // every such record would collide under the same String(undefined) === "undefined" key and silently
        // overwrite one another. We convert this to string so that it's a usable reference in our primary
        // storage map.
        const ids: string[] = [];
        const records: Record<string, any>[] = [];
        for (const record of data) {
            const recordId = record[idProp];
            if (recordId !== undefined && recordId !== null) {
                ids.push(String(recordId));
                records.push(record);
            }
        }

        // Now store each record
        for (let i = 0; i < ids.length; i++) {
            this.save(ids[i], records[i], ttl);
        }

        // Now store the id set, bounded by maxSize the same way entries are - otherwise a caller that varies the
        // set id per request/user/query (a normal saveSet usage pattern) would grow this map without limit.
        if (!this.sets.has(id) && this.sets.size >= this.maxSize) {
            this.sweep();
            while (this.sets.size >= this.maxSize && this.sets.size > 0) {
                CacheUtils.evictOldest(this.sets);
            }
        }
        this.sets.delete(id);
        this.sets.set(id, { ids, expiresAt: Date.now() + ttl * 1000 });
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
