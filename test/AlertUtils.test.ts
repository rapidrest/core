///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import { AlertUtils, Alert, AlertPriority } from "../src/AlertUtils.js";
import nock from "nock";
import { describe, it, expect, vi, afterEach } from "vitest";

const serviceUrl = "https://alerts.rapidrest.dev";

afterEach(() => {
    nock.cleanAll();
});

function makeLogger() {
    return { error: vi.fn(), debug: vi.fn(), warn: vi.fn(), info: vi.fn() };
}

function makeAlert(overrides: Partial<Alert> = {}): Alert {
    return {
        alias: "test-alias",
        description: "Something happened: {{reason}}",
        message: "Test message {{reason}}",
        priority: AlertPriority.Important,
        source: "unit-test",
        ...overrides,
    };
}

describe("AlertUtils Tests.", () => {
    describe("close()", () => {
        it("Returns true on success.", async () => {
            nock(serviceUrl).post("/alert1/close").reply(200, {});
            const alertUtils = new AlertUtils({ auth: "token", serviceUrl });
            expect(await alertUtils.close("alert1")).toBe(true);
        });

        it("Truncates note/source and returns true on success.", async () => {
            nock(serviceUrl).post("/alert1/close").reply(200, {});
            const alertUtils = new AlertUtils({ auth: "token", serviceUrl });
            expect(await alertUtils.close("alert1", { note: "n".repeat(30000), source: "s".repeat(200) })).toBe(true);
        });

        it("Returns false and logs on failure.", async () => {
            nock(serviceUrl).post("/alert1/close").replyWithError("network down");
            const logger = makeLogger();
            const alertUtils = new AlertUtils({ auth: "token", serviceUrl, logger });
            expect(await alertUtils.close("alert1")).toBe(false);
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe("get()", () => {
        it("Returns the alert on success.", async () => {
            nock(serviceUrl).get("/alert1").reply(200, { alias: "test-alias" });
            const alertUtils = new AlertUtils({ auth: "token", serviceUrl });
            const result = await alertUtils.get("alert1");
            expect(result).toBeDefined();
            expect(result?.alias).toBe("test-alias");
        });

        it("Returns null and logs on failure.", async () => {
            nock(serviceUrl).get("/alert1").replyWithError("network down");
            const logger = makeLogger();
            const alertUtils = new AlertUtils({ auth: "token", serviceUrl, logger });
            expect(await alertUtils.get("alert1")).toBeNull();
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe("send()", () => {
        it("Sends an alert and resolves the id on the first poll.", async () => {
            nock(serviceUrl).post("/").reply(200, { requestId: "req1" });
            nock(serviceUrl)
                .get("/requests/req1")
                .reply(200, { success: true, alertId: "alert1" });

            const alertUtils = new AlertUtils({ auth: "token", serviceUrl });
            const id = await alertUtils.send(
                makeAlert({ tags: ["a", "b"], note: "Note about {{reason}}" }),
                { reason: "test" },
            );
            expect(id).toBe("alert1");
        });

        it("Truncates tags beyond MAX_TAGS without throwing.", async () => {
            nock(serviceUrl).post("/").reply(200, { requestId: "req-tags" });
            nock(serviceUrl)
                .get("/requests/req-tags")
                .reply(200, { success: true, alertId: "alert-tags" });

            const manyTags = Array.from({ length: 25 }, (_, i) => `tag-${i}-${"x".repeat(60)}`);
            const alertUtils = new AlertUtils({ auth: "token", serviceUrl });
            const id = await alertUtils.send(makeAlert({ tags: manyTags, entity: "e".repeat(600) }));
            expect(id).toBe("alert-tags");
        });

        it("Returns null when no requestId is returned.", async () => {
            nock(serviceUrl).post("/").reply(200, {});
            const alertUtils = new AlertUtils({ auth: "token", serviceUrl });
            const id = await alertUtils.send(makeAlert());
            expect(id).toBeNull();
        });

        it("Keeps polling when the request is not yet ready, then resolves.", async () => {
            nock(serviceUrl).post("/").reply(200, { requestId: "req2" });
            nock(serviceUrl).get("/requests/req2").reply(200, { success: false });
            nock(serviceUrl)
                .get("/requests/req2")
                .reply(200, { success: true, alertId: "alert2" });

            const alertUtils = new AlertUtils({ auth: "token", serviceUrl });
            const id = await alertUtils.send(makeAlert());
            expect(id).toBe("alert2");
        });

        it("Retries after a polling error and eventually resolves.", async () => {
            nock(serviceUrl).post("/").reply(200, { requestId: "req3" });
            nock(serviceUrl).get("/requests/req3").replyWithError("temporarily unavailable");
            nock(serviceUrl)
                .get("/requests/req3")
                .reply(200, { success: true, alertId: "alert3" });

            const alertUtils = new AlertUtils({ auth: "token", serviceUrl });
            const id = await alertUtils.send(makeAlert());
            expect(id).toBe("alert3");
        }, 10000);

        it("Uploads attachments individually when zip is not requested.", async () => {
            nock(serviceUrl).post("/").reply(200, { requestId: "req4" });
            nock(serviceUrl)
                .get("/requests/req4")
                .reply(200, { success: true, alertId: "alert4" });
            nock(serviceUrl).post("/alert4/attachments").twice().reply(200, {});

            const alertUtils = new AlertUtils({ auth: "token", serviceUrl });
            const id = await alertUtils.send(makeAlert(), {}, {
                files: [
                    { contentType: "text/plain", data: Buffer.from("one"), filename: "one.txt" },
                    { contentType: "text/plain", data: Buffer.from("two"), filename: "two.txt" },
                ],
            });
            expect(id).toBe("alert4");
        });

        it("Uploads attachments as a single zip when requested.", async () => {
            nock(serviceUrl).post("/").reply(200, { requestId: "req5" });
            nock(serviceUrl)
                .get("/requests/req5")
                .reply(200, { success: true, alertId: "alert5" });
            nock(serviceUrl).post("/alert5/attachments").query({ indexFile: "one.txt" }).reply(200, {});

            const alertUtils = new AlertUtils({ auth: "token", serviceUrl });
            const id = await alertUtils.send(makeAlert(), {}, {
                files: [{ contentType: "text/plain", data: Buffer.from("one"), filename: "one.txt" }],
                zip: true,
                indexFile: "one.txt",
            });
            expect(id).toBe("alert5");
        });

        it("Returns null and logs (without a logger) when the request itself throws.", async () => {
            nock(serviceUrl).post("/").replyWithError("boom");
            const alertUtils = new AlertUtils({ auth: "token", serviceUrl });
            const id = await alertUtils.send(makeAlert());
            expect(id).toBeNull();
        });

        it("Returns null and logs (with a logger) when the request itself throws.", async () => {
            nock(serviceUrl).post("/").replyWithError("boom");
            const logger = makeLogger();
            const alertUtils = new AlertUtils({ auth: "token", serviceUrl, logger });
            const id = await alertUtils.send(makeAlert());
            expect(id).toBeNull();
            expect(logger.error).toHaveBeenCalledWith("Failed to send alert.");
        });
    });

    describe("addAttachment()", () => {
        it("Returns true on success without an indexFile.", async () => {
            nock(serviceUrl).post("/alert1/attachments").reply(200, {});
            const alertUtils = new AlertUtils({ auth: "token", serviceUrl });
            const result = await alertUtils.addAttachment("alert1", {
                contentType: "text/plain",
                data: Buffer.from("hello"),
                filename: "hello.txt",
            });
            expect(result).toBe(true);
        });

        it("Returns true on success with an indexFile.", async () => {
            nock(serviceUrl).post("/alert1/attachments").query({ indexFile: "hello.txt" }).reply(200, {});
            const alertUtils = new AlertUtils({ auth: "token", serviceUrl });
            const result = await alertUtils.addAttachment(
                "alert1",
                { contentType: "text/plain", data: Buffer.from("hello"), filename: "hello.txt" },
                "hello.txt",
            );
            expect(result).toBe(true);
        });

        it("Returns false and logs on failure.", async () => {
            nock(serviceUrl).post("/alert1/attachments").replyWithError("boom");
            const logger = makeLogger();
            const alertUtils = new AlertUtils({ auth: "token", serviceUrl, logger });
            const result = await alertUtils.addAttachment("alert1", {
                contentType: "text/plain",
                data: Buffer.from("hello"),
                filename: "hello.txt",
            });
            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalled();
        });
    });
});
