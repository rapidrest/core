import { MessagingUtils } from "../src/MessagingUtils.js";
import { ObjectFactory } from "../src/ObjectFactory.js";
import { Logger } from "../src/Logger.js";
import { describe, it, expect, vi, beforeEach } from "vitest";

const AppMock = vi.fn(function AppMock() {
  return {
    client: {
      chat: {
        postMessage: vi.fn().mockResolvedValue({ ok: true }),
      },
    },
  }
})
vi.mock("@slack/bolt", () => ({
  App: AppMock,
}))

vi.mock("nodemailer", () => ({
    createTransport: vi.fn().mockImplementation(() => ({
        sendMail: vi.fn().mockReturnValue(() => {
            // NO-OP
        }),
    })),
}));

describe("MessagingUtils Tests.", () => {
    let configuration;

    beforeEach(async () => {
        configuration = {
            slack: [{
                token: "test",
                signingSecret: "test-secret"
            }],
            smtp_config: [{
                host: "test"
            }],
            message_templates: {
                from: {
                    email: "mail"
                },
                test: {
                    enabled: true,
                    subject: "Alert",
                    slack_channel: "test",
                    slack_text: "Alert"
                }
            }
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
        delete configuration.message_templates;
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        await expect(messagingUtils.sendSlack("test", {})).rejects.toThrow("No template found with name test");
    });


    it("Cannot send slack, template not enabled.", async () => {
        const config = (await import("./config.js")).default;
        configuration.message_templates.test.enabled = false;
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        expect(await messagingUtils.sendSlack("test", {})).not.toBeDefined();
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
        delete configuration.message_templates;
        config.overrides(configuration);

        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        await expect(messagingUtils.sendEmail("test", {})).rejects.toThrow("No template found with name test");
    });

    it("Cannot send email, missing from.", async () => {
        const config = (await import("./config.js")).default;
        delete configuration.message_templates.from;
        config.overrides(configuration);

        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        expect(await messagingUtils.sendEmail("test", {})).not.toBeDefined();
    });

    it("Cannot send email, template not enabled.", async () => {
        const config = (await import("./config.js")).default;
        configuration.message_templates.test.enabled = false;
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        expect(await messagingUtils.sendEmail("test", {})).not.toBeDefined();
    });
});

