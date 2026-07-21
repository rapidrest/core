///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2026 Jean-Philippe Steinmetz. All rights reserved.
///////////////////////////////////////////////////////////////////////////////
import { Destroy } from "./decorators/ObjectDecorators.js";

/** How often the sweep interval reclaims expired, never-reloaded sessions. */
const SWEEP_INTERVAL_MS = 60_000;

export interface MemoryStoreEntry {
    data: Record<string, any>;
    expiresAt: number;
}

/**
 * Implements a simple key-value storage system in-memory for storing temporary records with a specified
 * lifetime (TTL) and size.
 *
 * @author Jean-Philippe Steinmetz
 */
export class MemoryStore {
    /** The default record TTL (in seconds). */
    public defaultTTL: number = 60;

    protected entries: Map<string, MemoryStoreEntry> = new Map();

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

    public async save(id: string, data: Record<string, any>, ttlSeconds: number = this.defaultTTL): Promise<void> {
        if (this.entries.size > this.maxSize) {
            this.entries.clear();
        }
        this.entries.set(id, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
    }

    public async delete(id: string): Promise<void> {
        this.entries.delete(id);
    }

    private sweep(): void {
        const now = Date.now();
        for (const [sessionId, entry] of this.entries.entries()) {
            if (entry.expiresAt <= now) this.entries.delete(sessionId);
        }
    }
}
