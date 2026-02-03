///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import axios, { AxiosResponse } from "axios";
import FormData from "form-data";
import { ReadStream } from "fs";
import handlebars from "handlebars";
import JSZip from "jszip";
import { sleep } from "./sleep.js";

const MAX_ATTEMPTS: number = 60;
const MAX_CHARS_ALIAS: number = 512;
const MAX_CHARS_DESCRIPTION: number = 15000;
const MAX_CHARS_ENTITY: number = 512;
const MAX_CHARS_MESSAGE: number = 130;
const MAX_CHARS_NOTE: number = 25000;
const MAX_CHARS_SOURCE: number = 100;
const MAX_CHARS_TAGS: number = 50;
const MAX_TAGS: number = 20;

/**
 * Describes the level of priority for a given alert and an importance for triaging the problem.
 */
export enum AlertPriority {
    /** Describes an alert that affects critical operating functionality or infrastructure. */
    Critical = "P1",
    /** Describes an alert that affects key systems that have great impact on end-user experiences. */
    Severe = "P2",
    /** Describes an alert that affects basic systems that may create a poor end-user experience. */
    Important = "P3",
    /** Describes an alert that has no material affect on the end-user experience but with potential to escalate. */
    Warning = "P4",
    /** Describes an alert that has no material affect on end-user experience and no potential for escalation. */
    Notice = "P5"
}

/**
 * Describes a single system failure or other similar critical event that requires immediate attention.
 */
export interface Alert {
    /** The name of the alert that uniquely identifies the report for purposes of de-duplication. */
    alias: string;
    /** The detailed information about the event that has occurred. */
    description: string;
    /** A key-value map of custom information about the alert. */
    details?: any;
    /** Used to specify a category or problem domain for filtering. */
    entity?: string;
    /** The basic summary of the alert that describes the event. */
    message: string;
    /** Additional detail about the event. */
    note?: string;
    /** The priority level of the alert. */
    priority: AlertPriority;
    /** The source of the alert. Can be a pod/service name, IP address or other unique identifier. */
    source: string;
    /** A list of unique tags to associate with the event. */
    tags?: string[];
}

/**
 * Describes a single attachment that can be added to an alert.
 */
export interface AlertAttachment {
    /** The content-type of the attachment. */
    contentType: string;
    /** The contents of the attachment. */
    data: Buffer | ReadStream;
    /** The name of the attachment. */
    filename: string;
    /** The size of the attachment. */
    size?: number;
}

/**
 * Describes a request to close an alert.
 */
export interface AlertClose {
    /** Display name of the request source. */
    source?: string;
    /** Additional alert note to add. */
    note?: string;
}

/**
 * The set of configuration options to pass to AlertUtils when creating an instance.
 */
export interface AlertUtilsOptions {
    /** The value of the Authorization header to apply to all outgoing HTTP requests. */
    auth: string;
    /** The full url of the REST API service that alerts will be sent to. */
    serviceUrl: string;
    /** The logging utility to use. */
    logger?: any;
}

/**
 * Describes the alert attachment options to use when creating an alert.
 */
export interface AlertUtilsAttachmentOptions {
    /** The attachment files to upload with the alert. */
    files: AlertAttachment[];
    /** The name of the index file when the attachment is a zip file. */
    indexFile?: string;
    /**
     * Set to `true` to to package all files into a single zip before being uploaded, otherwise set to `false` to
     * upload each file individually.
     */
    zip?: boolean;
}

/**
 * The `AlertUtils` class is used to send alerts about important system events that have occurred
 * and require further monitoring or intervention.
 */
export class AlertUtils {
    /** The logging utility to use. */
    private logger: any;
    /** The value of the Authorization header to apply to all outgoing HTTP requests. */
    private auth: string;
    /** The full url of the REST API service that alerts will be sent to. */
    private serviceUrl: string;

    /**
     * Creates a new instance of `AuthUtils` with the provided defaults.
     * @param options The configuration options to use.
     */
    constructor(options: AlertUtilsOptions) {
        this.auth = options.auth;
        this.logger = options.logger;
        this.serviceUrl = options.serviceUrl;
    }

    /**
     * Attempts to close the existing alert with the given identifier.
     * @param id The unique identifier of the alert to close.
     * @returns True if the operation was successful, otherwise false.
     */
    public async close(id: string, data: AlertClose = {}): Promise<boolean> {
        try {
            if (data.note) {
                data.note = data.note.substring(0, MAX_CHARS_NOTE);
            }
            if (data.source) {
                data.source = data.source.substring(0, MAX_CHARS_SOURCE);
            }

            const url: string = `${this.serviceUrl}/${id}/close`;
            const response: AxiosResponse = await axios.post(url, data, {
                headers: {
                    Authorization: this.auth,
                }
            });
            return response.status >= 200 && response.status < 300;
        } catch (err: any) {
            this.logger.error("Failed to close alert with id " + id);
            this.logger.error(err.message);
            return false;
        }
    }

    /**
     * Attempts to retrieve the existing alert with the given identifier.
     * @param id The unique identifier of the alert to retrieve.
     * @returns The retrieved alert if successful, otherwise `null`.
     */
    public async get(id: string): Promise<Alert | null> {
        try {
            const url: string = `${this.serviceUrl}/${id}`;
            const response: AxiosResponse = await axios.get(url, {
                headers: {
                    Authorization: this.auth,
                }
            });
            return response.status >= 200 && response.status < 300 ? response.data : null;
        } catch (err: any) {
            this.logger.error("Failed to retrieve alert with id " + id);
            this.logger.error(err.message);
            return null;
        }
    }

    /**
     * Sends the provided alert to the configured monitoring service.
     *
     * @param alert The alert to send.
     * @param vars A map of vars to perform replacement on for the alert's various properties.
     * @param attachments The attachments to upload along with the alert.
     * @returns The unique identifier of the created alert if the operation was successful, otherwise `null`.
     */
    public async send(alert: Alert, vars: any = {}, attachments?: AlertUtilsAttachmentOptions): Promise<string | null> {
        try {
            // Truncate the various properties to the maximimum allowed by the most restrictive known API (e.g. OpsGenie)
            alert.alias = alert.alias.substring(0, MAX_CHARS_ALIAS);
            alert.description = alert.description.substring(0, MAX_CHARS_DESCRIPTION);
            if (alert.entity) {
                alert.entity = alert.entity.substring(0, MAX_CHARS_ENTITY);
            }
            alert.message = alert.message.substring(0, MAX_CHARS_MESSAGE);
            if (alert.note) {
                alert.note = alert.note.substring(0, MAX_CHARS_NOTE);
            }
            alert.source = alert.source.substring(0, MAX_CHARS_SOURCE);
            if (alert.tags) {
                let tags: string[] = [];
                for (let i = 0; i < MAX_TAGS; i++) {
                    const tag: string = alert.tags[i];
                    tags.push(tag.substring(0, MAX_CHARS_TAGS));
                }
                alert.tags = tags;
            }

            // Process properties as templates
            let template: handlebars.TemplateDelegate = handlebars.compile(
                alert.description
            );
            alert.description = template(vars);
            template = handlebars.compile(alert.message);
            alert.message = template(vars);
            if (alert.note) {
                template = handlebars.compile(alert.note);
                alert.note = template(vars);
            }

            let response: AxiosResponse = await axios.post(this.serviceUrl, alert, {
                headers: {
                    Authorization: this.auth,
                }
            });
            const requestId: string | null = response.status >= 200 && response.status < 300 ? response.data.requestId : null;
            if (!requestId) {
                return null;
            }

            // Query the API for the final alert id
            let id: string | null = null;
            let count: number = 0;
            while (!id && count < MAX_ATTEMPTS) {
                try {
                    const url: string = `${this.serviceUrl}/requests/${requestId}}`;
                    const response: AxiosResponse = await axios.get(url, {
                        headers: {
                            Authorization: this.auth,
                        }
                    });
                    if (response.status >= 200  && response.status < 300) {
                        if (response.data.success && response.data.alertId) {
                            id = response.data.alertId;
                        }
                    }
                } catch (err: any) {
                    // We get here when the request isn't finished processing yet. OpsGenie's API is... meh.
                    // Wait a second before retrying
                    await sleep(1000);
                }

                count++;
            }

            // Now upload any attachments if they were provided
            if (id && attachments) {
                if (attachments.zip) {
                    // Package all attachments into a single zip file for upload
                    const zip = new JSZip();
                    for (const file of attachments.files) {
                        zip.file(file.filename, file.data);
                    }
                    const data: Buffer = await zip.generateAsync({ type: "nodebuffer" });
                    await this.addAttachment(id, {
                        contentType: "application/zip",
                        data,
                        filename: `${id}.zip`,
                        size: data.length
                    }, attachments.indexFile);
                } else {
                    // Upload each attachment individually
                    for (const file of attachments.files) {
                        await this.addAttachment(id, file, attachments.indexFile);
                    }
                }
            }

            return id;
        } catch (err: any) {
            this.logger?.error("Failed to send alert.");
            this.logger?.error(err.response?.data?.message || err.message);
            return null;
        }
    }

    /**
     * Uploads a single attachment to the alert with the given unique identifier.
     * @param id The unique identifier of the alert to add an attachment for.
     * @param attachment The file to upload as an attachment.
     * @param indexFile Sets the indexFile parameter of the request.
     * @returns True if the operation was successful, otherwise false.
     */
    public async addAttachment(id: string, attachment: AlertAttachment, indexFile?: string): Promise<boolean> {
        try {
            const form: FormData = new FormData();
            form.append("file", attachment.data, {
                contentType: attachment.contentType,
                filename: attachment.filename,
                knownLength: attachment.size
            });

            let url: string = `${this.serviceUrl}/${id}/attachments`;
            if (indexFile) {
                url += "&indexFile=" + indexFile;
            }
            const response: AxiosResponse = await axios.post(url, form, {
                headers: {
                    Authorization: this.auth,
                    "Content-Type": "multipart/form-data"
                }
            });

            return response.status >= 200 && response.status < 300;
        } catch (err: any) {
            // Don't fail the rest of the request if attachments fail
            this.logger?.error(`Failed to upload attachment ${attachment.filename} to alert ${id}.`);
            this.logger?.error(err.response?.data?.message || err.message);
            return false;
        }
    }
}
