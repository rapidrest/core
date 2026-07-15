///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import config from "./config.js";
import { EventUtils, Event } from "../src/TelemetryUtils.js";
import { JWTUtils } from "../src/JWTUtils.js";
import nock from "nock";
import { v4 as uuidV4 } from "uuid";
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

const userUid = uuidV4();
let authToken: string;

beforeAll(async () => {
    authToken = await JWTUtils.createToken(config.get("auth"), { uid: userUid, name: "test", roles: [] });
});

describe("TelemetryUtils Tests.", () => {
    beforeEach(() => {
        (EventUtils as any).initialized = false;
    });

    it("Can record event.", async () => {
        await EventUtils.init(config, undefined, authToken);

        const data: any = {
            prop1: "a",
            prop2: 10,
            prop3: true,
        };
        const event: Event = new Event(config, userUid, data);

        // Mock the call to session-services so that it succeeds.
        nock(config.get("telemetry_services:url"))
            .post("/events")
            .reply(201, event);

        let receivedEvent: boolean = false;
        EventUtils.on("TestEvent", (evt: Event) => {
            expect(evt.type).toEqual("TestEvent");
            expect(evt.userId).toBe(userUid);
            expect(evt).toHaveProperty("prop1");
            expect(evt).toHaveProperty("prop2");
            expect(evt).toHaveProperty("prop3");
            receivedEvent = true;
        });

        await EventUtils.record(data, "TestEvent");
        expect(receivedEvent).toBe(true);
    });

    it("Can record provided event.", async () => {
        const otherUid: string = uuidV4();
        await EventUtils.init(config, undefined, authToken);

        const data: any = {
            prop1: "a",
            prop2: 10,
            prop3: true,
        };
        const event: Event = new Event(config, userUid, data);

        // Mock the call to session-services so that it succeeds.
        nock(config.get("telemetry_services:url"))
            .post("/events")
            .reply(201, event);

        let receivedEvent: boolean = false;
        EventUtils.on("TestEvent", (evt: Event) => {
            expect(evt.type).toEqual("TestEvent");
            expect(evt.userId).toBe(otherUid);
            expect(evt).toHaveProperty("prop1");
            expect(evt).toHaveProperty("prop2");
            expect(evt).toHaveProperty("prop3");
            receivedEvent = true;
        });

        await EventUtils.record(new Event(config, otherUid, data), "TestEvent");
        expect(receivedEvent).toBe(true);
    });

    it("Can record event without type argument.", async () => {
        const otherUid: string = uuidV4();
        await EventUtils.init(config, undefined, authToken);

        const data: any = {
            prop1: "a",
            prop2: 10,
            prop3: true,
            type: "MyTestEvent"
        };
        const event: Event = new Event(config, userUid, data);

        // Mock the call to session-services so that it succeeds.
        nock(config.get("telemetry_services:url"))
            .post("/events")
            .reply(201, event);

        let receivedEvent: boolean = false;
        EventUtils.on("MyTestEvent", (evt: Event) => {
            expect(evt.type).toEqual("MyTestEvent");
            expect(evt.userId).toBe(otherUid);
            expect(evt).toHaveProperty("prop1");
            expect(evt).toHaveProperty("prop2");
            expect(evt).toHaveProperty("prop3");
            receivedEvent = true;
        });

        await EventUtils.record(new Event(config, otherUid, data));
        expect(receivedEvent).toBe(true);
    });

    it("Can't record event without initializing", async () => {
        const otherUid: string = uuidV4();
        const data: any = {
            prop1: "a",
            prop2: 10,
            prop3: true,
            type: "MyTestEvent"
        };
        const event: Event = new Event(config, userUid, data);

        // Mock the call to session-services so that it succeeds.
        nock(config.get("telemetry_services:url"))
            .post("/events")
            .reply(201, event);

        let receivedEvent: boolean = false;
        expect(() => {
            EventUtils.on("MyTestEvent", (evt: Event) => {
                receivedEvent = true;
            });
        }).toThrow(Error);

        await EventUtils.record(new Event(config, otherUid, data));
        expect(receivedEvent).toBe(false);
    });

    it("Event falls back to 'prod' as the environment when NODE_ENV is not set.", () => {
        // Note: the test runner already sets process.env.NODE_ENV (truthy) for the entire run, so every other
        // `new Event(...)` call in this file exercises the truthy leg of the ternary at src/TelemetryUtils.ts:56.
        // This test temporarily clears it to exercise the falsy/"prod" leg.
        const originalEnv = process.env.NODE_ENV;
        delete process.env.NODE_ENV;
        try {
            const event: Event = new Event(config, userUid, { type: "EnvTest" });
            expect(event.environment).toBe("prod");
        } finally {
            if (originalEnv === undefined) {
                delete process.env.NODE_ENV;
            } else {
                process.env.NODE_ENV = originalEnv;
            }
        }
    });

    it("Event derives its origin from the configured service name and skips protected fields.", () => {
        const stubConfig = {
            get: (key: string) => {
                if (key === "service_name") return "my-service";
                if (key === "version") return "2.0.0";
                return config.get(key);
            },
        };
        const data: any = {
            type: "CustomEvent",
            environment: "hacked",
            origin: "hacked",
            userId: "hacked",
            prop1: "value",
        };
        const event: Event = new Event(stubConfig, userUid, data);
        expect(event.origin).toBe("my-service:2.0.0");
        expect(event.environment).not.toBe("hacked");
        expect(event.userId).toBe(userUid);
        expect((event as any).prop1).toBe("value");
    });

    it("record logs via logger.debug when the telemetry service url is not configured.", async () => {
        const stubConfig = {
            get: (key: string) => (key === "telemetry_services:url" ? undefined : config.get(key)),
        };
        const debugSpy = vi.fn();
        await EventUtils.init(stubConfig, { debug: debugSpy, warn: vi.fn() }, authToken);
        await EventUtils.record({ type: "NoUrlEvent" });
        expect(debugSpy).toHaveBeenCalled();
    });

    it("record swallows an error and logs to console.warn when no logger is configured.", async () => {
        await EventUtils.init(config, undefined, authToken);
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
            // no-op
        });
        await expect(EventUtils.record({})).resolves.toBeUndefined();
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it("record swallows an error and logs via the configured logger.", async () => {
        const warnSpy = vi.fn();
        await EventUtils.init(config, { debug: vi.fn(), warn: warnSpy }, authToken);
        await expect(EventUtils.record({})).resolves.toBeUndefined();
        expect(warnSpy).toHaveBeenCalled();
    });

    it("on allows registering multiple listeners for an already-registered event type.", async () => {
        await EventUtils.init(config, undefined, authToken);
        const data: any = { prop1: "a" };
        const event: Event = new Event(config, userUid, data);

        nock(config.get("telemetry_services:url"))
            .post("/events")
            .reply(201, event);

        let count = 0;
        EventUtils.on("DupEvent", () => {
            count++;
        });
        EventUtils.on("DupEvent", () => {
            count++;
        });
        await EventUtils.record(data, "DupEvent");
        expect(count).toBe(2);
    });
});
