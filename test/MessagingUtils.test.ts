import { MessagingUtils } from "../src/MessagingUtils.js";
import { ObjectFactory } from "../src/ObjectFactory.js";
import { Logger } from "../src/Logger.js";
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import fs from "fs";

const AppMock = vi.fn(function AppMock() {
  return {
    client: {
      chat: {
        postMessage: vi.fn().mockResolvedValue({ ok: true }),
      },
    },
  }
})
// Allows individual tests to force the destructured `App` import to be falsy in order to exercise the
// "Failed to import @slack/bolt" guard in MessagingUtils#init().
let slackAppOverride: any = AppMock;
vi.mock("@slack/bolt", () => ({
  get App() {
    return slackAppOverride;
  },
}))

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
            const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
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
        configuration.twilio = { accountSid: "AC_test", token: "test-token" };
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
        await expect(messagingUtils.sendSMS("test", {})).rejects.toThrow("Twilio is not configured.");
    });

    it("Cannot send SMS, template not enabled.", async () => {
        const config = (await import("./config.js")).default;
        configuration.twilio = { accountSid: "AC_test", token: "test-token" };
        configuration.templates.test.sms = "Your code is {{code}}";
        configuration.templates.test.enabled = false;
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        expect(await messagingUtils.sendSMS("test", {})).not.toBeDefined();
    });

    it("Cannot send SMS, missing sms field.", async () => {
        const config = (await import("./config.js")).default;
        configuration.twilio = { accountSid: "AC_test", token: "test-token" };
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        expect(await messagingUtils.sendSMS("test", {})).not.toBeDefined();
    });

    it("Cannot send SMS, missing from.sms configuration (fails gracefully instead of throwing).", async () => {
        const config = (await import("./config.js")).default;
        configuration.twilio = { accountSid: "AC_test", token: "test-token" };
        configuration.templates.test.sms = "Your code is {{code}}";
        delete configuration.templates.from.sms;
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        expect(await messagingUtils.sendSMS("test", { code: "1234" })).not.toBeDefined();
    });

    it("Cannot setup twilio, missing accountSid.", async () => {
        const config = (await import("./config.js")).default;
        configuration.twilio = { accountSid: "", token: "test-token" };
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        await expect(messagingUtils.sendSMS("test", {})).rejects.toThrow("Twilio is not configured.");
    });

    it("Cannot setup twilio, missing token.", async () => {
        const config = (await import("./config.js")).default;
        configuration.twilio = { accountSid: "AC_test", token: "" };
        config.overrides(configuration);
        const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);
        await expect(messagingUtils.sendSMS("test", {})).rejects.toThrow("Twilio is not configured.");
    });

    describe("loadTemplate", () => {
        it("Does not (re-)load or compile fields that are absent, and caches the result.", async () => {
            const config = (await import("./config.js")).default;
            configuration.templates.test = { enabled: true };
            config.overrides(configuration);
            const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);

            const tpl1 = messagingUtils.loadTemplate("test");
            expect(tpl1.loaded).toBe(true);
            expect(tpl1.html).toBeUndefined();
            expect(tpl1.text).toBeUndefined();

            // Second call should hit the cached "already loaded" branch and return the same object.
            const tpl2 = messagingUtils.loadTemplate("test");
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
            const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);

            const tpl = messagingUtils.loadTemplate("test");
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
            const tplA = messagingUtilsA.loadTemplate("test");
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
            const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);

            const tpl1 = messagingUtils.loadTemplate("test");
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
            const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);

            const tpl1 = messagingUtils.loadTemplate("test");
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
            const messagingUtils: MessagingUtils = await new ObjectFactory(config, Logger()).newInstance(MessagingUtils);

            const tpl = messagingUtils.loadTemplate("test");
            expect(tpl.html).toBeUndefined();
            expect(tpl.text).toBeUndefined();
        });
    });
});
