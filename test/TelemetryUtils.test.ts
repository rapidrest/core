///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import config from "./config.js";
import { EventUtils, Event } from "../src/TelemetryUtils.js";
import { JWTUtils } from "../src/JWTUtils.js";
import nock from "nock";
import * as uuid from "uuid";
import { describe, it, expect, beforeEach } from "vitest";

const userUid = uuid.v4();
const authToken = JWTUtils.createToken(config.get("auth"), { uid: userUid, name: "test", roles: [] });

describe("TelemetryUtils Tests.", () => {
    beforeEach(() => {
        (EventUtils as any).initialized = false;
    });

    it("Can record event.", async () => {
        EventUtils.init(config, undefined, authToken);

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
        const otherUid: string = uuid.v4();
        EventUtils.init(config, undefined, authToken);

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
        const otherUid: string = uuid.v4();
        EventUtils.init(config, undefined, authToken);

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
        const otherUid: string = uuid.v4();
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
});
