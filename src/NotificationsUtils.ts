///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import { Logger } from "./decorators/ObjectDecorators.js";

/**
 * Utility functions for sending push notifications to registered clients.
 *
 * @author Jean-Philippe Steinmetz
 */
export class NotificationUtils {
    /** The redis client to use for broadcasting messages. */
    private redis: any;
    /** The logging utility to use. */
    @Logger
    private logger?: any;

    /**
     * Initializes the utility using the given redis connection.
     *
     * @param {any} redis The redis connection to publish to.
     * @param {any} logger The logging utility to use.
     */
    constructor(redis: any) {
        if (!redis) {
            throw new Error("redis argument is required.");
        }
        this.redis = redis;
    }

    /**
     * Publishes to the given redis channel, logging (rather than crashing the process via an unhandled rejection)
     * if the underlying client's `publish()` rejects.
     */
    private publish(channel: string, payload: string): void {
        try {
            const result: any = this.redis?.publish(channel, payload);
            if (result && typeof result.catch === "function") {
                result.catch((err: any) => {
                    this.logger?.error(`Failed to publish message to channel: ${channel}`);
                    this.logger?.debug(err);
                });
            }
        } catch (err: any) {
            this.logger?.error(`Failed to publish message to channel: ${channel}`);
            this.logger?.debug(err);
        }
    }

    /**
     * Broadcasts a given message to all users.
     *
     * @param {any} type The type of message being sent.
     * @param {string} action The action performed on the data (if applicable).
     * @param {string} data The contents of the message to send.
     */
    public broadcastMessage(type: any, action: string, data: any): void {
        this.publish("allusers", JSON.stringify({ type, action, data }));
    }

    /**
     * Sends a given message to the room or user with the specified uid(s).
     *
     * @param {string} uids The universally unique identifier of the room or user to send the message to.
     * @param {string} type The type of message being sent.
     * @param {string} action The action performed on the data (if applicable).
     * @param {string} data The contents of the message to send to the room or user.
     */
    public sendMessage(uids: string | string[], type: string, action: string, data: any): void {
        // Serialize once regardless of how many recipients
        const payload = JSON.stringify({ type, action, data });
        if (Array.isArray(uids)) {
            for (const uid of uids) {
                this.publish(uid, payload);
            }
        } else {
            this.publish(uids, payload);
        }
    }
}
