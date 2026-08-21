///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
// SPDX-License-Identifier: MPL-2.0
///////////////////////////////////////////////////////////////////////////////
import { NotificationUtils } from "../src/NotificationsUtils.js";
import { describe, it, expect, vi } from "vitest";

describe("NotificationUtils Tests.", () => {
    it("Throws when constructed without a redis connection.", () => {
        expect(() => new NotificationUtils(undefined)).toThrow("redis argument is required.");
    });

    it("Can broadcast a message to all users.", () => {
        const redis = { publish: vi.fn() };
        const notifications = new NotificationUtils(redis);
        notifications.broadcastMessage("alert", "created", { foo: "bar" });
        expect(redis.publish).toHaveBeenCalledWith(
            NotificationUtils.BROADCAST_CHANNEL,
            JSON.stringify({ type: "alert", action: "created", data: { foo: "bar" } }),
        );
    });

    it("Can send a message to a single user.", () => {
        const redis = { publish: vi.fn() };
        const notifications = new NotificationUtils(redis);
        notifications.sendMessage("user1", "alert", "created", { foo: "bar" });
        expect(redis.publish).toHaveBeenCalledWith(
            `${NotificationUtils.USER_CHANNEL_PREFIX}user1`,
            JSON.stringify({ type: "alert", action: "created", data: { foo: "bar" } }),
        );
    });

    it("Can send a message to multiple users.", () => {
        const redis = { publish: vi.fn() };
        const notifications = new NotificationUtils(redis);
        notifications.sendMessage(["user1", "user2"], "alert", "created", { foo: "bar" });
        expect(redis.publish).toHaveBeenCalledTimes(2);
        expect(redis.publish).toHaveBeenNthCalledWith(
            1,
            `${NotificationUtils.USER_CHANNEL_PREFIX}user1`,
            JSON.stringify({ type: "alert", action: "created", data: { foo: "bar" } }),
        );
        expect(redis.publish).toHaveBeenNthCalledWith(
            2,
            `${NotificationUtils.USER_CHANNEL_PREFIX}user2`,
            JSON.stringify({ type: "alert", action: "created", data: { foo: "bar" } }),
        );
    });

    it("Cannot craft a uid that collides with the broadcast channel.", () => {
        // Regression test for the channel-namespace collision this fix addresses: previously sendMessage()
        // published directly to the raw uid, so a caller-supplied uid of "allusers" landed on the exact same
        // channel broadcastMessage() used, delivering a scoped 1:1 message to every subscriber instead.
        const redis = { publish: vi.fn() };
        const notifications = new NotificationUtils(redis);
        notifications.sendMessage("allusers", "alert", "created", { foo: "bar" });
        expect(redis.publish).toHaveBeenCalledWith(
            `${NotificationUtils.USER_CHANNEL_PREFIX}allusers`,
            JSON.stringify({ type: "alert", action: "created", data: { foo: "bar" } }),
        );
        expect(redis.publish).not.toHaveBeenCalledWith(NotificationUtils.BROADCAST_CHANNEL, expect.anything());
    });

    it("Does not throw when the redis connection is later cleared.", () => {
        const redis = { publish: vi.fn() };
        const notifications = new NotificationUtils(redis);
        // Simulate the redis connection being torn down after construction to exercise the
        // optional-chaining branch guarding each publish call.
        (notifications as any).redis = undefined;
        expect(() => notifications.broadcastMessage("alert", "created", {})).not.toThrow();
        expect(() => notifications.sendMessage("user1", "alert", "created", {})).not.toThrow();
        expect(() => notifications.sendMessage(["user1", "user2"], "alert", "created", {})).not.toThrow();
    });

    it("Logs (rather than crashing via an unhandled rejection) when publish() rejects.", async () => {
        const logger = { error: vi.fn(), debug: vi.fn() };
        const err = new Error("connection lost");
        const redis = { publish: vi.fn().mockRejectedValue(err) };
        const notifications = new NotificationUtils(redis);
        (notifications as any).logger = logger;

        notifications.broadcastMessage("alert", "created", { foo: "bar" });
        // Let the rejected publish() promise's .catch() handler run.
        await new Promise((resolve) => setImmediate(resolve));

        expect(logger.error).toHaveBeenCalledWith(
            `Failed to publish message to channel: ${NotificationUtils.BROADCAST_CHANNEL}`,
        );
        expect(logger.debug).toHaveBeenCalledWith(err);
    });

    it("Logs (rather than crashing) when publish() throws synchronously.", () => {
        const logger = { error: vi.fn(), debug: vi.fn() };
        const err = new Error("client in a bad state");
        const redis = {
            publish: vi.fn(() => {
                throw err;
            }),
        };
        const notifications = new NotificationUtils(redis);
        (notifications as any).logger = logger;

        expect(() => notifications.broadcastMessage("alert", "created", { foo: "bar" })).not.toThrow();

        expect(logger.error).toHaveBeenCalledWith(
            `Failed to publish message to channel: ${NotificationUtils.BROADCAST_CHANNEL}`,
        );
        expect(logger.debug).toHaveBeenCalledWith(err);
    });
});
