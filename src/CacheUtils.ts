///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2026 Jean-Philippe Steinmetz. All rights reserved.
///////////////////////////////////////////////////////////////////////////////

/**
 * Utility functions for working with bounded in-memory caches.
 *
 * @author Jean-Philippe Steinmetz
 */
export class CacheUtils {
    /**
     * Evicts the oldest inserted entry from `map`, if any. A `Map` preserves insertion order, so this removes
     * whatever entry was `set()` least recently among those still present.
     *
     * @param map The map to evict the oldest entry from.
     */
    public static evictOldest<K, V>(map: Map<K, V>): void {
        const oldestKey: K | undefined = map.keys().next().value;
        if (oldestKey !== undefined) {
            map.delete(oldestKey);
        }
    }
}
