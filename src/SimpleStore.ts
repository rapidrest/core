///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2026 Jean-Philippe Steinmetz. All rights reserved.
///////////////////////////////////////////////////////////////////////////////

export interface MemoryStoreEntry {
    data: Record<string, any>;
    expiresAt: number;
}

/**
 * Defines an interface for a simple key-value storage system that stores temporary records with a specified
 * lifetime (TTL) and size. Supports the storage and retrieval of individual records as well as sets of records.
 *
 * @author Jean-Philippe Steinmetz
 */
export interface SimpleStore {
    /** The default record TTL (in seconds). */
    defaultTTL: number;
    /** The maximum number of records to store. */
    maxSize: number;

    /**
     * Deletes all entries in the storage system.
     */
    clear(): Promise<void> | void;

    /**
     * Deletes a single record with the given id.
     * @param id The id of the record to delete.
     */
    delete(id: string): Promise<void> | void;

    /**
     * Deletes the records associated with the list of given ids.
     * @param ids The list of ids to delete.
     */
    deleteMany(ids: string[]): Promise<void> | void;

    /**
     * Deletes the set of records associated with the given id.
     * @param ids The id of the set to delete.
     */
    deleteSet(id: string): Promise<void> | void;

    /**
     * Retrieves a single record with the given id.
     * @param id The id of the record to retrieve.
     */
    load(id: string): Promise<Record<string, any> | undefined> | Record<string, any> | undefined;

    /**
     * Retrieves the list of records for the given list of ids.
     * @param ids The list of ids of records to retrieve.
     */
    loadMany(ids: string[]): Promise<(Record<string, any> | undefined)[]> | (Record<string, any> | undefined)[];

    /**
     * Retrieves the set of records with the given id.
     * @param ids The id associated with the set of records to retrieve.
     */
    loadSet(
        id: string,
    ): Promise<(Record<string, any> | undefined)[] | undefined> | (Record<string, any> | undefined)[] | undefined;

    /**
     * Stores a single record with the given id for the specified TTL.
     * @param id The id of the record to retrieve.
     * @param data The record to store.
     * @param ttl The number of seconds that the record will be stored.
     */
    save(id: string, data: Record<string, any>, ttl?: number): Promise<void> | void;

    /**
     * Stores a list of records with the given list of ids for the specified TTL.
     * @param id The list of ids to store records for.
     * @param data The list of records to store.
     * @param ttl The number of seconds that each record will be stored.
     */
    saveMany(ids: string[], data: Record<string, any>[], ttl?: number): Promise<void> | void;

    /**
     * Stores a set of records with the given id for the specified TTL.
     * @param id The id of the record set to store.
     * @param data The record to store.
     * @param idProp The name of the property in data to use as an id for storage.
     * @param ttl The number of seconds that the set will be stored.
     */
    saveSet(id: string, data: Record<string, any>[], idProp: string, ttl?: number): Promise<void> | void;
}
