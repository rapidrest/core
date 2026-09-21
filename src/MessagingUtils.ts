///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
// SPDX-License-Identifier: MPL-2.0
///////////////////////////////////////////////////////////////////////////////
import axios from "axios";
import handlebars from "handlebars";
import { Config, Init, Logger } from "./decorators/ObjectDecorators.js";
import fs from "fs/promises";
import { FileUtils } from "./FileUtils.js";

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
    // The contents of messages to send via WhatsApp as free-form text. WhatsApp only delivers these within 24 hours
    // of the recipient's last message to you; use `whatsapp_template` to message anyone else.
    whatsapp?: string;
    // An approved WhatsApp message template to send instead of free-form text. Takes precedence over `whatsapp`,
    // as it is deliverable regardless of the 24-hour window.
    whatsapp_template?: WhatsAppTemplate;
    // A map of additional options to send with WhatsApp messages.
    whatsapp_options?: any;
}

export interface WhatsAppTemplate {
    // The name of the message template, as approved in Meta's WhatsApp Manager.
    name: string;
    // The language code the template was approved in, e.g. `en_US`.
    language: string;
    // Handlebars strings rendered into the template's body placeholders (`{{1}}`, `{{2}}`, ...), in order.
    parameters?: string[];
}

export interface SlackConfig {
    name: string;
    token: string;
    signingSecret: string;
}

/** The SMS providers that `MessagingUtils.sendSMS()` can deliver through. */
export type SmsProvider = "twilio" | "telnyx";
export interface SmsConfig {
    provider: SmsProvider;
    config?: TwilioConfig | TelnyxConfig;
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

export interface TelnyxConfig {
    // The Telnyx API key (v2).
    apiKey: string;
    // The ID of the messaging profile to send `sendSMS()` messages with. Optional; Telnyx otherwise uses the
    // profile that owns the `from` number.
    messagingProfileId?: string;
}

export interface WhatsAppConfig {
    // The access token for the WhatsApp Business Cloud API (a Meta system user token).
    accessToken: string;
    // The ID of the WhatsApp Business phone number to send from. This is Meta's ID for the number, not the number.
    phoneNumberId: string;
    // The Graph API version to use. Defaults to `DEFAULT_WHATSAPP_API_VERSION`.
    apiVersion?: string;
}

const TELNYX_API_URL = "https://api.telnyx.com/v2";
const WHATSAPP_API_URL = "https://graph.facebook.com";
const DEFAULT_WHATSAPP_API_VERSION = "v23.0";

/**
 * Simple utility class for sending templated messages via e-mail, SMS and more.
 */
export class MessagingUtils {
    protected slackApps: any[] = [];
    @Config("slack", [])
    protected slackConfigs: any[] = [];
    @Config("smtp_config", null)
    private smtpConfig?: SmtpConfig;
    /** Explicitly selects the SMS provider. When unset, Twilio is used if configured, otherwise Telnyx. */
    @Config("sms_config", null)
    private smsConfig?: SmsConfig | null;
    private telnyx?: TelnyxConfig;
    /** Twilio SDK instance (when twilio configured) */
    private twilio?: any;
    /** Validated WhatsApp configuration, set once in init(). */
    private whatsapp?: WhatsAppConfig;
    @Config("whatsapp", null)
    private whatsappConfig: WhatsAppConfig | null = null;
    @Config("templates", {})
    private templates: TemplateMap = {} as any;
    @Logger
    private logger?: any;

    /** Reusable nodemailer transporter created once in init(). */
    private _transporter: any;

    /** Cache of compiled Handlebars delegates keyed by "<templateName>:<field>". */
    private _compiledTemplates: Map<string, handlebars.TemplateDelegate> = new Map();

    /** Source string each `_compiledTemplates` entry was compiled from, keyed the same way. Lets `loadTemplate()`
     * detect when an existing field's value has changed (e.g. a live config reload editing a template's subject/
     * text/html) and recompile, instead of only ever compiling a field once and rendering stale content forever. */
    private _compiledTemplateSources: Map<string, string> = new Map();

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

        if (this.smsConfig && this.smsConfig.provider === "twilio") {
            try {
                const config: TwilioConfig | undefined = this.smsConfig.config as TwilioConfig;
                if (!config.accountSid || !config.token) {
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
                this.twilio = twilio.default(config.accountSid, config.token, config.options);
            } catch (error) {
                this.logger?.error("Unable to setup twilio notifications");
                this.logger?.debug(error);
            }
        }

        if (this.smsConfig && this.smsConfig.provider === "telnyx") {
            try {
                const config: TelnyxConfig | undefined = this.smsConfig.config as TelnyxConfig;
                if (!config.apiKey) {
                    throw new Error("Telnyx apiKey is not set.");
                }
                this.telnyx = config;
            } catch (error) {
                this.logger?.error("Unable to setup telnyx notifications");
                this.logger?.debug(error);
            }
        }

        if (this.whatsappConfig) {
            try {
                if (!this.whatsappConfig.accessToken || !this.whatsappConfig.phoneNumberId) {
                    throw new Error("WhatsApp accessToken or phoneNumberId is not set.");
                }

                this.whatsapp = this.whatsappConfig;
            } catch (error) {
                this.logger?.error("Unable to setup whatsapp notifications");
                this.logger?.debug(error);
            }
        }
    }

    /**
     * Loads the template with the given name and returns its contents as a string.
     * @param name The name of the template to load.
     */
    public async loadTemplate(name: string): Promise<Template> {
        if (!this.templates[name]) {
            throw new Error(`No template found with name ${name}`);
        }

        const tplConfig: Template = this.templates[name];

        // Load html/text from disk once per instance (I/O). Gated on this instance's own `_loadedTemplates` set
        // rather than `tplConfig.loaded`: the latter lives on the (potentially shared, config-provided)
        // `Template` object, so a second instance bound to the same config could otherwise see `loaded === true`
        // set by another instance without ever reading the files into its own template config.
        if (!this._loadedTemplates.has(name)) {
            // Check if a path is specified for the HTML template. If so load it. Uses `fs/promises` (rather
            // than the sync `existsSync`/`readFileSync`) so a template read on a live send path doesn't block
            // the event loop for every other in-flight request.
            if (tplConfig.htmlPath && (await FileUtils.exists(tplConfig.htmlPath))) {
                tplConfig.html = await fs.readFile(tplConfig.htmlPath, { encoding: "utf-8" });
            }

            // Check if a path is specified for the text template. If so load it.
            if (tplConfig.textPath && (await FileUtils.exists(tplConfig.textPath))) {
                tplConfig.text = await fs.readFile(tplConfig.textPath, { encoding: "utf-8" });
            }

            tplConfig.loaded = true;
            this._loadedTemplates.add(name);
        }

        // Compile and cache a Handlebars delegate for each field that's currently present and whose value has
        // changed since it was last compiled for *this instance*, rather than gating compilation on the one-time
        // "have we ever loaded this template" check above or on "have we ever compiled this field." Without
        // comparing against the previously-compiled source, a field added after the first load (e.g. a live
        // config reload that only sets `subject` once other fields already exist) would never get compiled,
        // leaving sendEmail()/sendSlack()/sendSMS() to call an `undefined` delegate and throw - and a field whose
        // *value* was edited in place (e.g. an admin updates an existing subject/text/html) would keep rendering
        // the stale delegate forever.
        const whatsappParams: string[] = tplConfig.whatsapp_template?.parameters ?? [];
        const fields: Array<[string, string | undefined]> = [
            ["text", tplConfig.text],
            ["html", tplConfig.html],
            ["subject", tplConfig.subject],
            ["sms", tplConfig.sms],
            ["slack_text", tplConfig.slack_text],
            ["whatsapp", tplConfig.whatsapp],
            ...whatsappParams.map((param, i): [string, string | undefined] => [`whatsapp_param_${i}`, param]),
        ];
        for (const [field, value] of fields) {
            const cacheKey = `${name}:${field}`;
            if (value) {
                if (this._compiledTemplateSources.get(cacheKey) !== value) {
                    this._compiledTemplates.set(cacheKey, handlebars.compile(value));
                    this._compiledTemplateSources.set(cacheKey, value);
                }
            } else if (this._compiledTemplateSources.has(cacheKey)) {
                // The field was cleared/removed (e.g. a live config reload disabling it) - drop the stale
                // compiled delegate rather than continuing to serve output from a value that's no longer current.
                this._compiledTemplates.delete(cacheKey);
                this._compiledTemplateSources.delete(cacheKey);
            }
        }

        // The loop above only visits parameters that still exist, so a `parameters` list that was shortened by a
        // live config reload would otherwise leave compiled delegates for the dropped trailing entries behind.
        const paramPrefix = `${name}:whatsapp_param_`;
        for (const key of [...this._compiledTemplateSources.keys()]) {
            if (key.startsWith(paramPrefix) && Number(key.slice(paramPrefix.length)) >= whatsappParams.length) {
                this._compiledTemplates.delete(key);
                this._compiledTemplateSources.delete(key);
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

        const tplConfig: Template = await this.loadTemplate(templateName);
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

        const tplConfig: Template = await this.loadTemplate(templateName);
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
     * Determines which SMS provider to deliver through. An explicit `sms_provider` setting always wins; otherwise
     * Twilio is preferred (for backwards compatibility with configurations that predate Telnyx support) and Telnyx
     * is used when it is the only provider configured. The choice is made from which config blocks are present, not
     * which initialized successfully, so an invalid provider config is reported as such rather than silently
     * falling through to the other provider.
     */
    private resolveSmsProvider(): SmsProvider {
        const provider: string | null | undefined = this.smsConfig?.provider;
        if (!provider) {
            throw new Error("SMS is not configured. Set either the twilio or telnyx configuration.");
        }
        if (provider === "twilio") {
            if (!this.twilio) {
                throw new Error("Twilio is not configured.");
            }
        } else if (provider === "telnyx") {
            if (!this.telnyx) {
                throw new Error("Telnyx is not configured.");
            }
        } else {
            throw new Error(`Unknown sms_provider '${provider}'. Expected 'twilio' or 'telnyx'.`);
        }
        return provider;
    }

    /**
     * Posts a JSON body to a bearer-authenticated provider API and returns the parsed response body.
     * @param provider The provider's name, used in error messages.
     * @param url The full request URL.
     * @param token The bearer token to authenticate with.
     * @param body The JSON request body.
     * @param getDetail Extracts the provider's explanation of a failure from its error response body.
     */
    private async postJson(
        provider: string,
        url: string,
        token: string,
        body: any,
        getDetail: (data: any) => string | undefined,
    ): Promise<any> {
        try {
            const response = await axios.post(url, body, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
            });
            return response.data;
        } catch (error: any) {
            // Providers explain failures in the response body; axios's own message is only "status code 4xx".
            const detail: string | undefined = getDetail(error?.response?.data);
            if (detail) {
                throw new Error(`${provider} request failed (${error.response.status}): ${detail}`);
            }
            throw error;
        }
    }

    /**
     * Sends a request to the Telnyx API and returns the `data` member of its response.
     * @param path The API path, relative to the v2 base URL.
     * @param body The JSON request body.
     */
    private async telnyxPost(path: string, body: any): Promise<any> {
        const data: any = await this.postJson(
            "Telnyx",
            `${TELNYX_API_URL}${path}`,
            this.telnyx!.apiKey,
            body,
            (d) => d?.errors?.[0]?.detail ?? d?.errors?.[0]?.title,
        );
        return data?.data;
    }

    /**
     * Sends an SMS using the given template name and variables.
     *
     * The provider is chosen by configuration: set `sms_provider` to `twilio` or `telnyx` to select one explicitly,
     * otherwise Twilio is used if configured and Telnyx if not. Both send from `from.sms` and take the recipient
     * (`to`) from `options`. Telnyx messages are sent through its Messaging API.
     *
     * @param templateName The name of the SMS template to send.
     * @param templateVars The map of variables to inject into the template.
     * @param options The map of additional options to pass to the SMS provider. Must include the recipient as `to`.
     * @returns The provider's message resource.
     */
    public async sendSMS(templateName: string, templateVars: any, options: any = {}): Promise<any> {
        const provider: SmsProvider = this.resolveSmsProvider();

        const tplConfig: Template = await this.loadTemplate(templateName);
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

        if (provider === "telnyx") {
            return this.telnyxPost("/messages", {
                ...(this.telnyx!.messagingProfileId && { messaging_profile_id: this.telnyx!.messagingProfileId }),
                ...tplConfig.sms_options,
                ...options,
                from: this.templates.from.sms,
                text: message,
            });
        }

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

    /**
     * Sends a WhatsApp message using the given template name and variables, through the WhatsApp Business Cloud API.
     *
     * The message is sent from the configured `whatsapp.phoneNumberId` to the recipient given as `options.to`. If the
     * template defines `whatsapp_template` an approved WhatsApp message template is sent, whose `parameters` are
     * rendered with the template variables. Otherwise the `whatsapp` text is sent as a free-form message, which
     * WhatsApp only delivers within 24 hours of the recipient's last message to you.
     *
     * @param templateName The name of the WhatsApp template to send.
     * @param templateVars The map of variables to inject into the template.
     * @param options The map of additional options to pass into the request. Must include the recipient as `to`.
     * @returns The WhatsApp response (`contacts` and `messages`). Delivery is asynchronous; a resolved promise means
     * WhatsApp accepted the message, not that it reached the recipient.
     */
    public async sendWhatsApp(templateName: string, templateVars: any, options: any = {}): Promise<any> {
        if (!this.whatsapp) {
            throw new Error("WhatsApp is not configured.");
        }

        const tplConfig: Template = await this.loadTemplate(templateName);
        const whatsappTemplate: WhatsAppTemplate | undefined = tplConfig.whatsapp_template;
        if (!tplConfig.enabled || !(whatsappTemplate || tplConfig.whatsapp)) {
            return undefined;
        }

        // Render using cached compiled delegates
        let content: any;
        if (whatsappTemplate) {
            const parameters = (whatsappTemplate.parameters ?? []).map((_, i) => ({
                type: "text",
                text: this._compiledTemplates.get(`${templateName}:whatsapp_param_${i}`)?.(templateVars) ?? "",
            }));
            content = {
                type: "template",
                template: {
                    name: whatsappTemplate.name,
                    language: { code: whatsappTemplate.language },
                    ...(parameters.length > 0 && { components: [{ type: "body", parameters }] }),
                },
            };
        } else {
            content = {
                type: "text",
                text: { body: this._compiledTemplates.get(`${templateName}:whatsapp`)!(templateVars) },
            };
        }

        // `options` is spread before the protected fields below so a caller cannot use it to override the message
        // type or the rendered message contents.
        return this.postJson(
            "WhatsApp",
            `${WHATSAPP_API_URL}/${this.whatsapp.apiVersion || DEFAULT_WHATSAPP_API_VERSION}/${this.whatsapp.phoneNumberId}/messages`,
            this.whatsapp.accessToken,
            {
                recipient_type: "individual",
                ...tplConfig.whatsapp_options,
                ...options,
                messaging_product: "whatsapp",
                ...content,
            },
            // Graph API errors are `{ error: { message, error_data: { details } } }`; `details` is the more specific.
            (d) => d?.error?.error_data?.details ?? d?.error?.message,
        );
    }
}
