///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import handlebars from "handlebars";
import { Config, Init, Logger } from "./decorators/ObjectDecorators.js";
import fs from "fs";

export interface OriginSettings {
    email: string;
    sms: string;
}

export interface TemplateMapBase {
    [name: string]: Template;
}

export type TemplateMap = Omit<TemplateMapBase, "from"> & {
    from: OriginSettings;
};

export interface Template {
    // Indicates if the template is enabled
    enabled: boolean;
    // Indicates if the template has been loaded.
    loaded?: boolean;
    // A map of additional options to send with e-mails.
    email_options?: any;
    // The subject line to use for e-mails and other similar messages
    subject?: string;
    // The contents of messages to send via e-mail (HTML).
    html?: string;
    // The path to a file with the contents of messages to send via e-mail (HTML).
    htmlPath?: string;
    // The name of the channel to send Slack messages to.
    slack_channel?: string;
    // The contents of messages to send via Slack.
    slack_text?: string;
    // The contents of messages to send via SMS.
    sms?: string;
    // A map of additional options to send with SMS.
    sms_options?: any;
    // The contents of messages to send via e-mail.
    text?: string;
    // The path to a file with the contents of messages to send via e-mail.
    textPath?: string;
}

export interface SlackConfig {
    name: string;
    token: string;
    signingSecret: string;
}

export interface SmtpAuth {
    user: string;
    pass: string;
}

export interface SmtpConfig {
    host: string;
    port: number;
    secure: boolean;
    auth?: SmtpAuth;
}

export interface TwilioConfig {
    accountSid: string;
    token: string;
    options?: any;
}

/**
 * Simple utility class for sending templated messages via e-mail, SMS and more.
 */
export class MessagingUtils {
    protected slackApps: any[] = [];
    @Config("slack", [])
    protected slackConfigs: any[] = [];
    @Config("smtp_config", null)
    private smtpConfig?: SmtpConfig;
    private twilio?: any;
    @Config("twilio", null)
    private twilioConfig: any = null;
    @Config("templates", {})
    private templates: TemplateMap = {} as any;
    @Logger
    private logger?: any;

    /** Reusable nodemailer transporter created once in init(). */
    private _transporter: any;

    /** Cache of compiled Handlebars delegates keyed by "<templateName>:<field>". */
    private _compiledTemplates: Map<string, handlebars.TemplateDelegate> = new Map();

    @Init
    public async init() {
        if (this.slackConfigs.length > 0) {
            try {
                const { App } = await import("@slack/bolt");
                if (!App) {
                    throw new Error("Failed to import @slack/bolt. Did you add it to your project?");
                }
                for (const slackConfig of this.slackConfigs) {
                    if (!slackConfig.token || !slackConfig.signingSecret) {
                        throw new Error("Slack token or signingSecret is not set.");
                    }

                    const app: any = new App({
                        token: slackConfig.token,
                        signingSecret: slackConfig.signingSecret,
                    });
                    this.slackApps.push(app);
                }
            } catch (error) {
                this.logger?.error("Unable to setup slack notifications");
                this.logger?.debug(error);
            }
        }

        if (this.smtpConfig) {
            try {
                const nodemailer: any = await import("nodemailer");
                /* v8 ignore next 3 -- a dynamically-imported ES module namespace object is always an
                   object per spec (never null/undefined), so this guard can never be true. Kept as
                   defense-in-depth in case of unusual bundler/loader interop. */
                if (!nodemailer) {
                    throw new Error("Failed to import nodemailer. Did you add it to your project?");
                }

                if (!this.smtpConfig.host) {
                    throw new Error("No host specified in SMTP configuration.");
                }

                this._transporter = nodemailer.createTransport(this.smtpConfig);
            } catch (error) {
                this.logger?.error("Unable to setup email notifications");
                this.logger?.debug(error);
            }
        }

        if (this.twilioConfig) {
            try {
                if (!this.twilioConfig.accountSid || !this.twilioConfig.token) {
                    throw new Error("Twilio accountSid or token is not set.");
                }

                const twilio: any = await import("twilio");
                /* v8 ignore next 3 -- a dynamically-imported ES module namespace object is always an
                   object per spec (never null/undefined), so this guard can never be true. Kept as
                   defense-in-depth in case of unusual bundler/loader interop. */
                if (!twilio) {
                    throw new Error("Failed to import twilio. Did you add it to your project?");
                }
                // `twilio`'s dynamic import only exposes a callable `default` export; the module namespace
                // object itself is not callable (unlike e.g. nodemailer, which re-exports its named members).
                this.twilio = twilio.default(this.twilioConfig.accountSid, this.twilioConfig.token, this.twilioConfig.options);
            } catch (error) {
                this.logger?.error("Unable to setup twilio notifications");
                this.logger?.debug(error);
            }
        }
    }

    /**
     * Loads the template with the given name and returns its contents as a string.
     * @param name The name of the template to load.
     */
    public loadTemplate(name: string): Template {
        if (!this.templates[name]) {
            throw new Error(`No template found with name ${name}`);
        }

        const tplConfig: Template = this.templates[name];
        if (tplConfig.loaded) {
            return tplConfig;
        }

        // Check if a path is specified for the HTML template. If so load it.
        if (tplConfig.htmlPath && fs.existsSync(tplConfig.htmlPath)) {
            tplConfig.html = fs.readFileSync(tplConfig.htmlPath, { encoding: "utf-8" });
        }

        // Check if a path is specified for the text template. If so load it.
        if (tplConfig.textPath && fs.existsSync(tplConfig.textPath)) {
            tplConfig.text = fs.readFileSync(tplConfig.textPath, { encoding: "utf-8" });
        }

        tplConfig.loaded = true;

        // Compile and cache all Handlebars delegates on first load
        if (tplConfig.text) this._compiledTemplates.set(`${name}:text`, handlebars.compile(tplConfig.text));
        if (tplConfig.html) this._compiledTemplates.set(`${name}:html`, handlebars.compile(tplConfig.html));
        if (tplConfig.subject) this._compiledTemplates.set(`${name}:subject`, handlebars.compile(tplConfig.subject));
        if (tplConfig.sms) this._compiledTemplates.set(`${name}:sms`, handlebars.compile(tplConfig.sms));
        if (tplConfig.slack_text) this._compiledTemplates.set(`${name}:slack_text`, handlebars.compile(tplConfig.slack_text));

        return tplConfig;
    }

    /**
     * Sends an email using the given template name and variables.
     * @param templateName The name of the email template to send.
     * @param templateVars The map of variables to inject into the template.
     * @param options The map of additional options to pass into the sendMail function.
     * @returns
     */
    public async sendEmail(templateName: string, templateVars: any, options: any = {}): Promise<any> {
        if (!this.smtpConfig) {
            throw new Error("E-mail is not configured.");
        }

        const tplConfig: Template = this.loadTemplate(templateName);
        if (!tplConfig.enabled || !tplConfig.subject) {
            return undefined;
        }

        // Render using cached compiled delegates
        const message: string | null = this._compiledTemplates.get(`${templateName}:text`)?.(templateVars) ?? null;
        const htmlMessage: string | null = this._compiledTemplates.get(`${templateName}:html`)?.(templateVars) ?? null;
        const subject: string = this._compiledTemplates.get(`${templateName}:subject`)!(templateVars);

        // Lazily create the transporter if init() did not succeed in creating it
        if (!this._transporter) {
            const nodemailer: any = await import("nodemailer");
            this._transporter = nodemailer.createTransport(this.smtpConfig);
        }

        // Send the e-mail to the user
        if (!this.templates?.from?.email) {
            this.logger?.warn("Unable to send email missing from.email in message template");
            return undefined;
        }
        // `options` is spread before the protected fields below so a caller cannot use it to override the
        // configured sender or the rendered message contents (e.g. spoofed `from`, injected `bcc`).
        const result: any = await this._transporter.sendMail({
            ...tplConfig.email_options,
            ...options,
            from: this.templates.from.email,
            subject,
            text: message,
            html: htmlMessage,
        });

        return result;
    }

    /**
     * Sends an Slack message using the given template name and variables.
     * @param templateName The name of the Slack template to send.
     * @param templateVars The map of variables to inject into the template.
     * @returns
     */
    public async sendSlack(templateName: string, templateVars: any): Promise<any[] | undefined> {
        if (this.slackApps.length === 0) {
            throw new Error("Slack is not configured.");
        }

        const tplConfig: Template = this.loadTemplate(templateName);
        if (!tplConfig.enabled || !tplConfig.slack_channel || !tplConfig.slack_text) {
            return undefined;
        }

        // Render using cached compiled delegate
        const message: string = this._compiledTemplates.get(`${templateName}:slack_text`)!(templateVars);

        const result: any[] = [];
        // Send the slack message to the desired channel
        for (const app of this.slackApps) {
            const res: any = await app.client.chat.postMessage({
                channel: tplConfig.slack_channel,
                text: message,
            });
            result.push(res);
        }

        return result;
    }

    /**
     * Sends an SMS using the given template name and variables.
     * @param templateName The name of the SMS template to send.
     * @param templateVars The map of variables to inject into the template.
     * @param options The map of additional options to pass into the sendMail function.
     * @returns
     */
    public async sendSMS(templateName: string, templateVars: any, options: any = {}): Promise<any> {
        if (!this.twilio) {
            throw new Error("Twilio is not configured.");
        }

        const tplConfig: Template = this.loadTemplate(templateName);
        if (!tplConfig.enabled || !tplConfig.sms) {
            return undefined;
        }

        // Render using cached compiled delegate
        const message: string = this._compiledTemplates.get(`${templateName}:sms`)!(templateVars);

        // Send the message to the user. `options` is spread before the protected fields below so a caller cannot
        // use it to override the configured sender or the rendered message body.
        const result: any = await this.twilio.messages.create({
            ...tplConfig.sms_options,
            ...options,
            from: this.templates.from.sms,
            body: message,
        });

        return result;
    }
}
