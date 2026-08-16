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
    /**
     * The redis channel `broadcastMessage()` publishes to. Namespaced (rather than a bare `"allusers"`) so it
     * can never collide with a per-recipient channel `sendMessage()` derives from a caller-supplied uid - a
     * client-facing "send a message to this uid" feature that passes its recipient straight through to
     * `sendMessage()` must not be able to choose a uid that lands on the broadcast channel and reach every
     * subscriber instead of the intended one recipient.
     */
    public static readonly BROADCAST_CHANNEL = "broadcast:allusers";
    /**
     * Prefix applied to every per-recipient channel in `sendMessage()`. Combined with `BROADCAST_CHANNEL`'s own
     * distinct `"broadcast:"` prefix, this guarantees the two channel namespaces can never overlap regardless of
     * what uid value a caller supplies.
     */
    public static readonly USER_CHANNEL_PREFIX = "user:";

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
     * Subscribers must listen on `NotificationUtils.BROADCAST_CHANNEL` (rather than a bare `"allusers"`) to
     * receive these messages.
     *
     * @param {any} type The type of message being sent.
     * @param {string} action The action performed on the data (if applicable).
     * @param {string} data The contents of the message to send.
     */
    public broadcastMessage(type: any, action: string, data: any): void {
        this.publish(NotificationUtils.BROADCAST_CHANNEL, JSON.stringify({ type, action, data }));
    }

    /**
     * Sends a given message to the room or user with the specified uid(s).
     *
     * Each recipient's channel is `NotificationUtils.USER_CHANNEL_PREFIX + uid` (rather than the bare uid), so
     * that no caller-supplied uid can collide with `NotificationUtils.BROADCAST_CHANNEL` or any other reserved
     * channel and be delivered to unintended subscribers. Subscribers must listen on that prefixed channel name
     * to receive messages sent to their uid.
     *
     * @param {string} uids The universally unique identifier of the room or user to send the message to.
     * @param {string} type The type of message being sent.
     * @param {string} action The action performed on the data (if applicable).
     * @param {string} data The contents of the message to send to the room or user.
     */
    public sendMessage(uids: string | string[], type: string, action: string, data: any): void {
        // Serialize once regardless of how many recipients
        const payload = JSON.stringify({ type, action, data });
        const targets = Array.isArray(uids) ? uids : [uids];
        for (const uid of targets) {
            this.publish(`${NotificationUtils.USER_CHANNEL_PREFIX}${uid}`, payload);
        }
    }
}
