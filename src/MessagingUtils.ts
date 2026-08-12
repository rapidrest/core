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

    /** Names of templates already compiled into `_compiledTemplates` for this instance. See `loadTemplate()`. */
    private _loadedTemplates: Set<string> = new Set();

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

        // Load html/text from disk once per instance (I/O). Gated on this instance's own `_loadedTemplates` set
        // rather than `tplConfig.loaded`: the latter lives on the (potentially shared, config-provided)
        // `Template` object, so a second instance bound to the same config could otherwise see `loaded === true`
        // set by another instance without ever reading the files into its own template config.
        if (!this._loadedTemplates.has(name)) {
            // Check if a path is specified for the HTML template. If so load it.
            if (tplConfig.htmlPath && fs.existsSync(tplConfig.htmlPath)) {
                tplConfig.html = fs.readFileSync(tplConfig.htmlPath, { encoding: "utf-8" });
            }

            // Check if a path is specified for the text template. If so load it.
            if (tplConfig.textPath && fs.existsSync(tplConfig.textPath)) {
                tplConfig.text = fs.readFileSync(tplConfig.textPath, { encoding: "utf-8" });
            }

            tplConfig.loaded = true;
            this._loadedTemplates.add(name);
        }

        // Compile and cache a Handlebars delegate for each field that's currently present but not yet compiled
        // for *this instance*, rather than gating compilation on the one-time "have we ever loaded this
        // template" check above. Without this, a field added to the template config after the first load (e.g.
        // a live config reload that only sets `subject` once other fields already exist) would never get
        // compiled, leaving sendEmail()/sendSlack()/sendSMS() to call an `undefined` delegate and throw.
        const fields: Array<[string, string | undefined]> = [
            ["text", tplConfig.text],
            ["html", tplConfig.html],
            ["subject", tplConfig.subject],
            ["sms", tplConfig.sms],
            ["slack_text", tplConfig.slack_text],
        ];
        for (const [field, value] of fields) {
            const cacheKey = `${name}:${field}`;
            if (value && !this._compiledTemplates.has(cacheKey)) {
                this._compiledTemplates.set(cacheKey, handlebars.compile(value));
            }
        }

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

        // Send to every configured Slack workspace concurrently - they're independent deliveries to different
        // apps/tokens, so there's no reason to pay N round-trips of latency sequentially on this alerting path.
        const result: any[] = await Promise.all(
            this.slackApps.map((app) =>
                app.client.chat.postMessage({
                    channel: tplConfig.slack_channel,
                    text: message,
                }),
            ),
        );

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

        // Mirrors sendEmail()'s equivalent guard: fail gracefully (rather than throwing a TypeError from
        // dereferencing `this.templates.from.sms` below) when `from.sms` isn't configured, e.g. because
        // `templates.from` was only ever set up for e-mail.
        if (!this.templates?.from?.sms) {
            this.logger?.warn("Unable to send SMS missing from.sms in message template");
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
