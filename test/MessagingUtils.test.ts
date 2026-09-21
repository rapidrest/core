///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
// SPDX-License-Identifier: MPL-2.0
///////////////////////////////////////////////////////////////////////////////
import { MessagingUtils } from "../src/MessagingUtils.js";
import { ObjectFactory } from "../src/ObjectFactory.js";
import { Logger } from "../src/Logger.js";
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from "vitest";
import fs from "fs";
import nock from "nock";

const AppMock = vi.fn(function AppMock() {
    return {
        client: {
            chat: {
                postMessage: vi.fn().mockResolvedValue({ ok: true }),
            },
        },
    };
});
// Allows individual tests to force the destructured `App` import to be falsy in order to exercise the
// "Failed to import @slack/bolt" guard in MessagingUtils#init().
let slackAppOverride: any = AppMock;
vi.mock("@slack/bolt", () => ({
    get App() {
        return slackAppOverride;
    },
}));

vi.mock("nodemailer", () => ({
    createTransport: vi.fn().mockImplementation(() => ({
        // Echoes back the mail options it was called with so tests can assert on the rendered content.
        sendMail: vi.fn().mockImplementation((mailOptions: any) => mailOptions),
    })),
}));

const twilioMessagesCreateMock = vi.fn().mockResolvedValue({ sid: "SM_test" });
const TwilioMock = vi.fn(function TwilioMock() {
    return {
        messages: {
            create: twilioMessagesCreateMock,
        },
    };
});
// The real "twilio" package's dynamic import only exposes a callable `default` export (its whole module
// namespace object is never itself callable), so the mock mirrors that shape.
vi.mock("twilio", () => ({
    default: TwilioMock,
}));

describe("MessagingUtils Tests.", () => {
    let configuration;
    const htmlPath = "./test-messaging-template.html";
    const textPath = "./test-messaging-template.txt";
    const missingHtmlPath = "./test-messaging-template-missing.html";
    const missingTextPath = "./test-messaging-template-missing.txt";

    beforeAll(() => {
        fs.writeFileSync(htmlPath, "<p>Hello {{name}}</p>");
        fs.writeFileSync(textPath, "Hello {{name}}");
    });

    afterAll(() => {
        fs.rmSync(htmlPath, { force: true });
        fs.rmSync(textPath, { force: true });
    });

    beforeEach(async () => {
        slackAppOverride = AppMock;
        twilioMessagesCreateMock.mockClear();
        configuration = {
            slack: [
                {
                    token: "test",
                    signingSecret: "test-secret",
                },
            ],
            smtp_config: {
                host: "test",
            },
            templates: {
                from: {
                    email: "mail",
                    sms: "+15555555555",
                },
                test: {
                    enabled: true,
                    subject: "Alert",
                    slack_channel: "test",
                    slack_text: "Alert",
                },
            },
        };
    });
    it("Can send slack.", async () => {
        const config = (await import("./config.ts")).default;
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        const result = await messagingUtils.sendSlack("test", {});
        expect(result).toBeDefined();
        if (result) {
            expect(result[0].ok).toBe(true);
        }
    });

    it("Cannot send slack, missing authentication.", async () => {
        const config = (await import("./config.ts")).default;
        delete configuration.slack;
        config.overrides(configuration);

        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        await expect(messagingUtils.sendSlack("test", {})).rejects.toThrow("Slack is not configured.");
    });

    it("Cannot send slack, missing template.", async () => {
        const config = (await import("./config.js")).default;
        delete configuration.templates;
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        await expect(messagingUtils.sendSlack("test", {})).rejects.toThrow("No template found with name test");
    });

    it("Cannot send slack, template not enabled.", async () => {
        const config = (await import("./config.js")).default;
        configuration.templates.test.enabled = false;
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        expect(await messagingUtils.sendSlack("test", {})).not.toBeDefined();
    });

    it("Cannot send slack, missing slack_channel.", async () => {
        const config = (await import("./config.js")).default;
        delete configuration.templates.test.slack_channel;
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        expect(await messagingUtils.sendSlack("test", {})).not.toBeDefined();
    });

    it("Cannot send slack, missing slack_text.", async () => {
        const config = (await import("./config.js")).default;
        delete configuration.templates.test.slack_text;
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        expect(await messagingUtils.sendSlack("test", {})).not.toBeDefined();
    });

    it("Cannot setup slack, missing token.", async () => {
        const config = (await import("./config.js")).default;
        configuration.slack = [{ token: "", signingSecret: "test-secret" }];
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        await expect(messagingUtils.sendSlack("test", {})).rejects.toThrow("Slack is not configured.");
    });

    it("Cannot setup slack, missing signingSecret.", async () => {
        const config = (await import("./config.js")).default;
        configuration.slack = [{ token: "test", signingSecret: "" }];
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        await expect(messagingUtils.sendSlack("test", {})).rejects.toThrow("Slack is not configured.");
    });

    it("sendSlack sends to all configured Slack workspaces concurrently.", async () => {
        const config = (await import("./config.js")).default;
        configuration.slack = [
            { token: "test1", signingSecret: "test-secret1" },
            { token: "test2", signingSecret: "test-secret2" },
        ];
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        const result = await messagingUtils.sendSlack("test", {});
        expect(result).toHaveLength(2);
        expect(result?.[0].ok).toBe(true);
        expect(result?.[1].ok).toBe(true);
    });

    it("Cannot setup slack, @slack/bolt does not export App.", async () => {
        slackAppOverride = undefined;
        try {
            const config = (await import("./config.js")).default;
            config.overrides(configuration);
            const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(
                MessagingUtils,
            );
            await expect(messagingUtils.sendSlack("test", {})).rejects.toThrow("Slack is not configured.");
        } finally {
            slackAppOverride = AppMock;
        }
    });

    it("Can send email.", async () => {
        const config = (await import("./config.js")).default;
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        const result = await messagingUtils.sendEmail("test", {});
        expect(result).toBeDefined();
    });

    it("Cannot send email, missing configuration.", async () => {
        const config = (await import("./config.js")).default;
        delete configuration.smtp_config;
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        await expect(messagingUtils.sendEmail("test", {})).rejects.toThrow("E-mail is not configured.");
    });

    it("Cannot send email, missing template.", async () => {
        const config = (await import("./config.js")).default;
        delete configuration.templates;
        config.overrides(configuration);

        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        await expect(messagingUtils.sendEmail("test", {})).rejects.toThrow("No template found with name test");
    });

    it("Cannot send email, missing from.", async () => {
        const config = (await import("./config.js")).default;
        delete configuration.templates.from;
        config.overrides(configuration);

        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        expect(await messagingUtils.sendEmail("test", {})).not.toBeDefined();
    });

    it("Cannot send email, template not enabled.", async () => {
        const config = (await import("./config.js")).default;
        configuration.templates.test.enabled = false;
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        expect(await messagingUtils.sendEmail("test", {})).not.toBeDefined();
    });

    it("Cannot send email, missing subject.", async () => {
        const config = (await import("./config.js")).default;
        delete configuration.templates.test.subject;
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        expect(await messagingUtils.sendEmail("test", {})).not.toBeDefined();
    });

    it("Can send email, lazily creates transporter when SMTP host is missing at init time.", async () => {
        const config = (await import("./config.js")).default;
        configuration.smtp_config = {};
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        const result = await messagingUtils.sendEmail("test", {});
        expect(result).toBeDefined();
    });

    it("Can send email with html/text loaded from htmlPath/textPath files.", async () => {
        const config = (await import("./config.js")).default;
        configuration.templates.test.htmlPath = htmlPath;
        configuration.templates.test.textPath = textPath;
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        const result = await messagingUtils.sendEmail("test", { name: "World" });
        expect(result).toBeDefined();
        expect(result.html).toContain("Hello World");
        expect(result.text).toContain("Hello World");
    });

    it("Can send SMS.", async () => {
        const config = (await import("./config.js")).default;
        configuration.sms_config = { provider: "twilio", config: { accountSid: "AC_test", token: "test-token" } };
        configuration.templates.test.sms = "Your code is {{code}}";
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        const result = await messagingUtils.sendSMS("test", { code: "1234" });
        expect(result).toBeDefined();
        expect(result.sid).toBe("SM_test");
        expect(twilioMessagesCreateMock).toHaveBeenCalled();
    });

    it("Cannot send SMS, missing configuration.", async () => {
        const config = (await import("./config.js")).default;
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        await expect(messagingUtils.sendSMS("test", {})).rejects.toThrow("SMS is not configured.");
    });

    it("Cannot send SMS, template not enabled.", async () => {
        const config = (await import("./config.js")).default;
        configuration.sms_config = { provider: "twilio", config: { accountSid: "AC_test", token: "test-token" } };
        configuration.templates.test.sms = "Your code is {{code}}";
        configuration.templates.test.enabled = false;
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        expect(await messagingUtils.sendSMS("test", {})).not.toBeDefined();
    });

    it("Cannot send SMS, missing sms field.", async () => {
        const config = (await import("./config.js")).default;
        configuration.sms_config = { provider: "twilio", config: { accountSid: "AC_test", token: "test-token" } };
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        expect(await messagingUtils.sendSMS("test", {})).not.toBeDefined();
    });

    it("Cannot send SMS, missing from.sms configuration (fails gracefully instead of throwing).", async () => {
        const config = (await import("./config.js")).default;
        configuration.sms_config = { provider: "twilio", config: { accountSid: "AC_test", token: "test-token" } };
        configuration.templates.test.sms = "Your code is {{code}}";
        delete configuration.templates.from.sms;
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        expect(await messagingUtils.sendSMS("test", { code: "1234" })).not.toBeDefined();
    });

    it("Cannot setup twilio, missing accountSid.", async () => {
        const config = (await import("./config.js")).default;
        configuration.sms_config = { provider: "twilio", config: { accountSid: "", token: "test-token" } };
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        await expect(messagingUtils.sendSMS("test", {})).rejects.toThrow("Twilio is not configured.");
    });

    it("Cannot setup twilio, missing token.", async () => {
        const config = (await import("./config.js")).default;
        configuration.sms_config = { provider: "twilio", config: { accountSid: "AC_test", token: "" } };
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        await expect(messagingUtils.sendSMS("test", {})).rejects.toThrow("Twilio is not configured.");
    });

    describe("Telnyx", () => {
        const telnyxUrl = "https://api.telnyx.com";

        beforeEach(() => {
            configuration.sms_config = { provider: "telnyx", config: { apiKey: "KEY_test" } };
            configuration.templates.test.sms = "Your code is {{code}}";
        });

        afterEach(() => {
            nock.cleanAll();
        });

        const create = async (): Promise<MessagingUtils> => {
            const config = (await import("./config.js")).default;
            config.overrides(configuration);
            return new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        };

        describe("sendSMS (Messaging API)", () => {
            it("Can send SMS via Telnyx.", async () => {
                let body: any;
                let headers: any;
                nock(telnyxUrl)
                    .post("/v2/messages", (b) => {
                        body = b;
                        return true;
                    })
                    .reply(function () {
                        headers = this.req.headers;
                        return [200, { data: { id: "msg_1", type: "SMS" } }];
                    });

                const messagingUtils = await create();
                const result = await messagingUtils.sendSMS("test", { code: "1234" }, { to: "+15005550006" });

                expect(result).toEqual({ id: "msg_1", type: "SMS" });
                expect(headers.authorization).toBe("Bearer KEY_test");
                expect(body).toEqual({ from: "+15555555555", to: "+15005550006", text: "Your code is 1234" });
                expect(twilioMessagesCreateMock).not.toHaveBeenCalled();
            });

            it("Sends the configured messaging profile and forwards extra options, without letting them override from/text.", async () => {
                configuration.sms_config.config.messagingProfileId = "profile_1";
                configuration.templates.test.sms_options = { webhook_url: "https://example.com/hook" };
                let body: any;
                nock(telnyxUrl)
                    .post("/v2/messages", (b) => {
                        body = b;
                        return true;
                    })
                    .reply(200, { data: {} });

                const messagingUtils = await create();
                await messagingUtils.sendSMS(
                    "test",
                    { code: "1234" },
                    { to: "+15005550006", from: "+19999999999", text: "spoofed" },
                );

                expect(body).toEqual({
                    messaging_profile_id: "profile_1",
                    webhook_url: "https://example.com/hook",
                    to: "+15005550006",
                    from: "+15555555555",
                    text: "Your code is 1234",
                });
            });

            it("Cannot send SMS via Telnyx, missing from.sms (fails gracefully).", async () => {
                delete configuration.templates.from.sms;
                const messagingUtils = await create();
                expect(
                    await messagingUtils.sendSMS("test", { code: "1234" }, { to: "+15005550006" }),
                ).not.toBeDefined();
            });

            it("Surfaces Telnyx's error detail when the API rejects the request.", async () => {
                nock(telnyxUrl)
                    .post("/v2/messages")
                    .reply(401, { errors: [{ title: "Authentication failed", detail: "The API key is invalid." }] });
                const messagingUtils = await create();
                await expect(messagingUtils.sendSMS("test", {}, { to: "+15005550006" })).rejects.toThrow(
                    "Telnyx request failed (401): The API key is invalid.",
                );
            });

            it("Rethrows the original error when Telnyx gives no error detail.", async () => {
                nock(telnyxUrl).post("/v2/messages").reply(500, {});
                const messagingUtils = await create();
                await expect(messagingUtils.sendSMS("test", {}, { to: "+15005550006" })).rejects.toThrow(
                    "Request failed with status code 500",
                );
            });

            it("Cannot setup telnyx, missing apiKey.", async () => {
                configuration.sms_config = { provider: "telnyx", config: { apiKey: "" } };
                const messagingUtils = await create();
                await expect(messagingUtils.sendSMS("test", {}, { to: "+15005550006" })).rejects.toThrow(
                    "Telnyx is not configured.",
                );
            });
        });

        describe("sms_config", () => {
            it("Uses Twilio, not Telnyx, when sms_config.provider is 'twilio'.", async () => {
                configuration.sms_config = {
                    provider: "twilio",
                    config: { accountSid: "AC_test", token: "test-token" },
                };
                const messagingUtils = await create();
                const result = await messagingUtils.sendSMS("test", { code: "1234" }, { to: "+15005550006" });
                expect(result.sid).toBe("SM_test");
            });

            it("Cannot send SMS, sms_config has no provider.", async () => {
                configuration.sms_config = {};
                const messagingUtils = await create();
                await expect(messagingUtils.sendSMS("test", {}, { to: "+15005550006" })).rejects.toThrow(
                    "SMS is not configured.",
                );
            });

            it("Cannot send SMS with an unknown provider.", async () => {
                configuration.sms_config = { provider: "carrier-pigeon", config: { apiKey: "KEY_test" } };
                const messagingUtils = await create();
                await expect(messagingUtils.sendSMS("test", {}, { to: "+15005550006" })).rejects.toThrow(
                    "Unknown sms_provider 'carrier-pigeon'",
                );
            });

            it("Cannot setup twilio or telnyx, sms_config.config is missing.", async () => {
                configuration.sms_config = { provider: "twilio" };
                const twilioMissing = await create();
                await expect(twilioMissing.sendSMS("test", {}, { to: "+15005550006" })).rejects.toThrow(
                    "Twilio is not configured.",
                );

                configuration.sms_config = { provider: "telnyx" };
                const telnyxMissing = await create();
                await expect(telnyxMissing.sendSMS("test", {}, { to: "+15005550006" })).rejects.toThrow(
                    "Telnyx is not configured.",
                );
            });
        });
    });

    describe("WhatsApp", () => {
        const graphUrl = "https://graph.facebook.com";
        const sendPath = "/v23.0/1055/messages";
        const accepted = {
            messaging_product: "whatsapp",
            contacts: [{ wa_id: "15005550006" }],
            messages: [{ id: "wamid.1" }],
        };

        beforeEach(() => {
            configuration.whatsapp = { accessToken: "EAAG_test", phoneNumberId: "1055" };
            configuration.templates.test.whatsapp = "Your code is {{code}}";
        });

        afterEach(() => {
            nock.cleanAll();
        });

        const create = async (): Promise<MessagingUtils> => {
            const config = (await import("./config.js")).default;
            config.overrides(configuration);
            return new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        };

        // Registers a nock for the send endpoint that captures the request body and headers.
        const captureSend = (path = sendPath, reply: [number, any] = [200, accepted]) => {
            const captured: { body?: any; headers?: any } = {};
            nock(graphUrl)
                .post(path, (b) => {
                    captured.body = b;
                    return true;
                })
                .reply(function () {
                    captured.headers = this.req.headers;
                    return reply;
                });
            return captured;
        };

        it("Can send a free-form text message.", async () => {
            const sent = captureSend();
            const messagingUtils = await create();
            const result = await messagingUtils.sendWhatsApp("test", { code: "1234" }, { to: "15005550006" });

            expect(result).toEqual(accepted);
            expect(sent.headers.authorization).toBe("Bearer EAAG_test");
            expect(sent.body).toEqual({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: "15005550006",
                type: "text",
                text: { body: "Your code is 1234" },
            });
        });

        it("Uses the configured Graph API version.", async () => {
            configuration.whatsapp.apiVersion = "v99.0";
            const sent = captureSend("/v99.0/1055/messages");
            const messagingUtils = await create();
            await messagingUtils.sendWhatsApp("test", { code: "1234" }, { to: "15005550006" });
            expect(sent.body.type).toBe("text");
        });

        it("Sends an approved message template with rendered parameters, in preference to free-form text.", async () => {
            configuration.templates.test.whatsapp_template = {
                name: "login_code",
                language: "en_US",
                parameters: ["{{name}}", "{{code}}"],
            };
            const sent = captureSend();
            const messagingUtils = await create();
            await messagingUtils.sendWhatsApp("test", { name: "Alice", code: "1234" }, { to: "15005550006" });

            expect(sent.body.type).toBe("template");
            expect(sent.body.text).toBeUndefined();
            expect(sent.body.template).toEqual({
                name: "login_code",
                language: { code: "en_US" },
                components: [
                    {
                        type: "body",
                        parameters: [
                            { type: "text", text: "Alice" },
                            { type: "text", text: "1234" },
                        ],
                    },
                ],
            });
        });

        it("Sends an approved message template that has no parameters without a components list.", async () => {
            delete configuration.templates.test.whatsapp;
            configuration.templates.test.whatsapp_template = { name: "welcome", language: "en_US" };
            const sent = captureSend();
            const messagingUtils = await create();
            await messagingUtils.sendWhatsApp("test", {}, { to: "15005550006" });

            expect(sent.body.template).toEqual({ name: "welcome", language: { code: "en_US" } });
        });

        it("Renders a blank template parameter as an empty string.", async () => {
            configuration.templates.test.whatsapp_template = {
                name: "login_code",
                language: "en_US",
                parameters: ["{{code}}", ""],
            };
            const sent = captureSend();
            const messagingUtils = await create();
            await messagingUtils.sendWhatsApp("test", { code: "1234" }, { to: "15005550006" });

            expect(sent.body.template.components[0].parameters).toEqual([
                { type: "text", text: "1234" },
                { type: "text", text: "" },
            ]);
        });

        it("Forwards whatsapp_options and options without letting them override the message type or contents.", async () => {
            configuration.templates.test.whatsapp_options = { biz_opaque_callback_data: "order-1" };
            const sent = captureSend();
            const messagingUtils = await create();
            await messagingUtils.sendWhatsApp(
                "test",
                { code: "1234" },
                {
                    to: "15005550006",
                    context: { message_id: "wamid.0" },
                    messaging_product: "sms",
                    type: "template",
                    text: { body: "spoofed" },
                },
            );

            expect(sent.body).toEqual({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                biz_opaque_callback_data: "order-1",
                to: "15005550006",
                context: { message_id: "wamid.0" },
                type: "text",
                text: { body: "Your code is 1234" },
            });
        });

        it("Cannot send WhatsApp, template not enabled.", async () => {
            configuration.templates.test.enabled = false;
            const messagingUtils = await create();
            expect(await messagingUtils.sendWhatsApp("test", {}, { to: "15005550006" })).not.toBeDefined();
        });

        it("Cannot send WhatsApp, template has neither whatsapp nor whatsapp_template.", async () => {
            delete configuration.templates.test.whatsapp;
            const messagingUtils = await create();
            expect(await messagingUtils.sendWhatsApp("test", {}, { to: "15005550006" })).not.toBeDefined();
        });

        it("Cannot send WhatsApp, missing template.", async () => {
            delete configuration.templates.test;
            const messagingUtils = await create();
            await expect(messagingUtils.sendWhatsApp("test", {}, { to: "15005550006" })).rejects.toThrow(
                "No template found with name test",
            );
        });

        it("Cannot send WhatsApp, missing configuration.", async () => {
            delete configuration.whatsapp;
            const messagingUtils = await create();
            await expect(messagingUtils.sendWhatsApp("test", {}, { to: "15005550006" })).rejects.toThrow(
                "WhatsApp is not configured.",
            );
        });

        it("Cannot setup whatsapp, missing accessToken or phoneNumberId.", async () => {
            configuration.whatsapp = { accessToken: "", phoneNumberId: "1055" };
            const noToken = await create();
            await expect(noToken.sendWhatsApp("test", {}, { to: "15005550006" })).rejects.toThrow(
                "WhatsApp is not configured.",
            );

            configuration.whatsapp = { accessToken: "EAAG_test", phoneNumberId: "" };
            const noNumber = await create();
            await expect(noNumber.sendWhatsApp("test", {}, { to: "15005550006" })).rejects.toThrow(
                "WhatsApp is not configured.",
            );
        });

        it("Surfaces WhatsApp's error detail, preferring error_data.details over the generic message.", async () => {
            nock(graphUrl)
                .post(sendPath)
                .reply(400, {
                    error: { message: "(#100) Invalid parameter", error_data: { details: "Recipient is invalid." } },
                });
            const messagingUtils = await create();
            await expect(messagingUtils.sendWhatsApp("test", {}, { to: "nope" })).rejects.toThrow(
                "WhatsApp request failed (400): Recipient is invalid.",
            );
        });

        it("Falls back to the error message when WhatsApp gives no details.", async () => {
            nock(graphUrl)
                .post(sendPath)
                .reply(401, { error: { message: "Invalid OAuth access token." } });
            const messagingUtils = await create();
            await expect(messagingUtils.sendWhatsApp("test", {}, { to: "15005550006" })).rejects.toThrow(
                "WhatsApp request failed (401): Invalid OAuth access token.",
            );
        });

        it("Rethrows the original error when WhatsApp gives no error detail.", async () => {
            nock(graphUrl).post(sendPath).reply(500, {});
            const messagingUtils = await create();
            await expect(messagingUtils.sendWhatsApp("test", {}, { to: "15005550006" })).rejects.toThrow(
                "Request failed with status code 500",
            );
        });

        it("Drops compiled delegates for template parameters removed after the first load.", async () => {
            configuration.templates.test.whatsapp_template = {
                name: "login_code",
                language: "en_US",
                parameters: ["{{name}}", "{{code}}"],
            };
            const first = captureSend();
            const messagingUtils = await create();
            await messagingUtils.sendWhatsApp("test", { name: "Alice", code: "1234" }, { to: "15005550006" });
            expect(first.body.template.components[0].parameters).toHaveLength(2);
            const compiled: Map<string, unknown> = (messagingUtils as any)._compiledTemplates;
            expect(compiled.has("test:whatsapp_param_1")).toBe(true);

            // Simulate a live config reload shortening the parameters list on the shared template object.
            const tpl = await messagingUtils.loadTemplate("test");
            tpl.whatsapp_template!.parameters = ["{{name}}"];
            const second = captureSend();
            await messagingUtils.sendWhatsApp("test", { name: "Alice", code: "1234" }, { to: "15005550006" });

            expect(second.body.template.components[0].parameters).toEqual([{ type: "text", text: "Alice" }]);
            expect(compiled.has("test:whatsapp_param_0")).toBe(true);
            expect(compiled.has("test:whatsapp_param_1")).toBe(false);
        });
    });

    describe("loadTemplate", () => {
        it("Does not (re-)load or compile fields that are absent, and caches the result.", async () => {
            const config = (await import("./config.js")).default;
            configuration.templates.test = { enabled: true };
            config.overrides(configuration);
            const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(
                MessagingUtils,
            );

            const tpl1 = await messagingUtils.loadTemplate("test");
            expect(tpl1.loaded).toBe(true);
            expect(tpl1.html).toBeUndefined();
            expect(tpl1.text).toBeUndefined();

            // Second call should hit the cached "already loaded" branch and return the same object.
            const tpl2 = await messagingUtils.loadTemplate("test");
            expect(tpl2).toBe(tpl1);
        });

        it("Loads html/text from htmlPath/textPath and compiles all present fields.", async () => {
            const config = (await import("./config.js")).default;
            configuration.templates.test = {
                enabled: true,
                subject: "Alert Subject {{name}}",
                slack_channel: "test",
                slack_text: "Alert Slack {{name}}",
                sms: "Alert SMS {{name}}",
                htmlPath,
                textPath,
            };
            config.overrides(configuration);
            const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(
                MessagingUtils,
            );

            const tpl = await messagingUtils.loadTemplate("test");
            expect(tpl.loaded).toBe(true);
            expect(tpl.html).toContain("Hello {{name}}");
            expect(tpl.text).toContain("Hello {{name}}");
        });

        it("A second instance sharing the same config compiles its own templates instead of trusting another instance's 'loaded' flag.", async () => {
            const config = (await import("./config.js")).default;
            configuration.templates.test = {
                enabled: true,
                subject: "Alert Subject {{name}}",
            };
            config.overrides(configuration);
            const factory = new ObjectFactory(config, Logger());

            // Both instances are bound to the same underlying config object (nconf.get() returns a live
            // reference for nested paths, not a clone), reproducing two independently-created MessagingUtils
            // instances sharing one `templates` config.
            const messagingUtilsA: MessagingUtils = await factory.newInstance(MessagingUtils, { name: "a" });
            const messagingUtilsB: MessagingUtils = await factory.newInstance(MessagingUtils, { name: "b" });

            // The first instance compiles and caches the template, marking the shared config's `loaded` flag.
            const tplA = await messagingUtilsA.loadTemplate("test");
            expect(tplA.loaded).toBe(true);

            // The second instance must still populate its own compiled-template cache rather than short-circuit
            // on the shared `loaded` flag, otherwise sendEmail() below would throw a TypeError.
            await expect(messagingUtilsB.sendEmail("test", { name: "World" })).resolves.toBeDefined();
        });

        it("Compiles a field added to the template config after the first load instead of leaving a stale delegate.", async () => {
            const config = (await import("./config.js")).default;
            // Start with `subject` absent so the first loadTemplate() call has nothing to compile for it.
            configuration.templates.test = { enabled: true };
            config.overrides(configuration);
            const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(
                MessagingUtils,
            );

            const tpl1 = await messagingUtils.loadTemplate("test");
            expect(tpl1.subject).toBeUndefined();

            // Simulate a live config reload adding `subject` to the same (shared) template object after the
            // first load - this must not leave sendEmail() calling an undefined compiled delegate.
            tpl1.subject = "Alert Subject {{name}}";
            await expect(messagingUtils.sendEmail("test", { name: "World" })).resolves.toBeDefined();
        });

        it("Drops the compiled delegate for a field that is cleared after the first load instead of keeping stale output.", async () => {
            const config = (await import("./config.js")).default;
            configuration.templates.test = {
                enabled: true,
                subject: "Alert Subject",
                text: "Hello {{name}}",
            };
            config.overrides(configuration);
            const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(
                MessagingUtils,
            );

            const tpl1 = await messagingUtils.loadTemplate("test");
            expect(tpl1.text).toBe("Hello {{name}}");
            const first = await messagingUtils.sendEmail("test", { name: "World" });
            expect(first.text).toBe("Hello World");

            // Simulate a live config reload clearing `text` on the same (shared) template object.
            tpl1.text = "";
            const second = await messagingUtils.sendEmail("test", { name: "World" });
            expect(second.text).toBeNull();
        });

        it("Does not load html/text when htmlPath/textPath point to non-existent files.", async () => {
            const config = (await import("./config.js")).default;
            configuration.templates.test = {
                enabled: true,
                subject: "Alert",
                htmlPath: missingHtmlPath,
                textPath: missingTextPath,
            };
            config.overrides(configuration);
            const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(
                MessagingUtils,
            );

            const tpl = await messagingUtils.loadTemplate("test");
            expect(tpl.html).toBeUndefined();
            expect(tpl.text).toBeUndefined();
        });
    });
});
