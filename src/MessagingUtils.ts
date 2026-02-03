///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import handlebars from "handlebars";
import { Config, Init, Logger } from "./decorators/ObjectDecorators.js";

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
    // A map of additional options to send with e-mails.
    email_options?: any;
    // The subject line to use for e-mails and other similar messages
    subject?: string;
    // The contents of messages to send via e-mail (HTML).
    html?: string;
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
    @Config("message_templates", {})
    private templates: TemplateMap = {} as any;
    @Logger
    private logger?: any;

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
                if (!nodemailer) {
                    throw new Error("Failed to import nodemailer. Did you add it to your project?");
                }

                if (!this.smtpConfig.host) {
                    throw new Error("No host specified in SMTP configuration.");
                }
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
                if (!twilio) {
                    throw new Error("Failed to import twilio. Did you add it to your project?");
                }
                this.twilio = twilio(this.twilioConfig.accountSid, this.twilioConfig.token, this.twilioConfig.options);
            } catch (error) {
                this.logger?.error("Unable to setup twilio notifications");
                this.logger?.debug(error);
            }
        }
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
        if (!this.templates[templateName]) {
            throw new Error(`No template found with name ${templateName}`);
        }

        const tplConfig: Template = this.templates[templateName];
        if (!tplConfig.enabled || !tplConfig.subject) {
            return undefined;
        }

        // Create the plain text template
        let message: string | null = null;
        if (tplConfig.text) {
            const template: handlebars.TemplateDelegate = handlebars.compile(tplConfig.text);
            message = template(templateVars);
        }

        // Create the HTML template
        let htmlMessage: string | null = null;
        if (tplConfig.html) {
            const template: handlebars.TemplateDelegate = handlebars.compile(tplConfig.html);
            htmlMessage = template(templateVars);
        }

        const subjectTemplate: handlebars.TemplateDelegate = handlebars.compile(tplConfig.subject);
        const subject: string = subjectTemplate(templateVars);

        // Send the e-mail to the user
        const nodemailer: any = await import("nodemailer");
        const transporter = nodemailer.createTransport(this.smtpConfig);
        if (!this.templates?.from?.email) {
            this.logger?.warn("Unable to send email missing from.email in message template");
            return undefined;
        }
        const result: any = await transporter.sendMail({
            from: this.templates.from.email,
            ...tplConfig.email_options,
            ...options,
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
        if (!this.templates[templateName]) {
            throw new Error(`No template found with name ${templateName}`);
        }

        const tplConfig: Template = this.templates[templateName];
        if (!tplConfig.enabled || !tplConfig.slack_channel || !tplConfig.slack_text) {
            return undefined;
        }

        // Create the sms template
        const template: handlebars.TemplateDelegate = handlebars.compile(tplConfig.slack_text);
        const message: string = template(templateVars);

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
        if (!this.templates[templateName]) {
            throw new Error(`No template found with name ${templateName}`);
        }

        const tplConfig: Template = this.templates[templateName];
        if (!tplConfig.enabled || !tplConfig.sms) {
            return undefined;
        }

        // Create the sms template
        const template: handlebars.TemplateDelegate = handlebars.compile(tplConfig.sms);
        const message: string = template(templateVars);

        // Send the message to the user
        const result: any = await this.twilio.messages.create({
            from: this.templates.from.sms,
            ...tplConfig.sms_options,
            ...options,
            body: message,
        });

        return result;
    }
}
