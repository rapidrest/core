///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
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
            "allusers",
            JSON.stringify({ type: "alert", action: "created", data: { foo: "bar" } }),
        );
    });

    it("Can send a message to a single user.", () => {
        const redis = { publish: vi.fn() };
        const notifications = new NotificationUtils(redis);
        notifications.sendMessage("user1", "alert", "created", { foo: "bar" });
        expect(redis.publish).toHaveBeenCalledWith(
            "user1",
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
            "user1",
            JSON.stringify({ type: "alert", action: "created", data: { foo: "bar" } }),
        );
        expect(redis.publish).toHaveBeenNthCalledWith(
            2,
            "user2",
            JSON.stringify({ type: "alert", action: "created", data: { foo: "bar" } }),
        );
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
});
