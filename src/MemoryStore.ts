///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2026 Jean-Philippe Steinmetz. All rights reserved.
///////////////////////////////////////////////////////////////////////////////
import { CacheUtils } from "./CacheUtils.js";
import { Destroy } from "./decorators/ObjectDecorators.js";
import { MemoryStoreEntry, SimpleStore } from "./SimpleStore.js";

/** How often the sweep interval reclaims expired, never-reloaded sessions. */
const SWEEP_INTERVAL_MS = 60_000;

/**
 * Implements a SimpleStore storage system that uses a local in-memory storage map.
 *
 * @author Jean-Philippe Steinmetz
 */
export class MemoryStore<T> implements SimpleStore<T> {
    /** The default record TTL (in seconds). */
    public defaultTTL: number = 60;

    protected entries: Map<string, MemoryStoreEntry<T>> = new Map();

    /** The maximum number of records to store. */
    public maxSize: number = 10000;

    private sweepTimer: ReturnType<typeof setInterval>;

    constructor() {
        this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
        this.sweepTimer.unref?.();
    }

    /** Stops the background sweep timer. Call when the owning `SessionManager` is destroyed. */
    @Destroy
    public destroy(): void {
        clearInterval(this.sweepTimer);
    }

    public load(id: string): Record<string, T> | undefined {
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

    public save(id: string, data: Record<string, T>, ttl: number = this.defaultTTL): void {
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

    public delete(id: string): void {
        this.entries.delete(id);
    }

    private sweep(): void {
        const now = Date.now();
        for (const [sessionId, entry] of this.entries.entries()) {
            if (entry.expiresAt <= now) this.entries.delete(sessionId);
        }
    }
}
