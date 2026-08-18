///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2026 Jean-Philippe Steinmetz. All rights reserved.
///////////////////////////////////////////////////////////////////////////////

export interface MemoryStoreEntry {
    data: Record<string, any>;
    expiresAt: number;
}

/**
 * Defines an interface for a simple key-value storage system that stores temporary records with a specified
 * lifetime (TTL) and size.
 *
 * @author Jean-Philippe Steinmetz
 */
export interface SimpleStore {
    /** The default record TTL (in seconds). */
    defaultTTL: number;
    /** The maximum number of records to store. */
    maxSize: number;

    /**
     * Deletes the record with the given id.
     * @param id The id of the record to delete.
     */
    delete(id: string): Promise<void> | void;

    /**
     * Retrieves the record with the given id.
     * @param id The id of the record to retrieve.
     */
    load(id: string): Promise<Record<string, any> | undefined> | Record<string, any> | undefined;

    /**
     * Stores the record with the given id for the specified TTL.
     * @param id The id of the record to retrieve.
     * @param data The record to store.
     * @param ttl The number of seconds that the record will be stored.
     */
    save(id: string, data: Record<string, any>, ttl: number): Promise<void> | void;
}
