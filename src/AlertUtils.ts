///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
// SPDX-License-Identifier: MPL-2.0
///////////////////////////////////////////////////////////////////////////////
import axios, { AxiosResponse } from "axios";
import FormData from "form-data";
import { ReadStream } from "fs";
import JSZip from "jszip";
import { sleep } from "./sleep.js";
import { StringUtils } from "./StringUtils.js";

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

    /** Returns `true` if `status` is a 2XX HTTP success code. Shared by every method below that inspects a
     * response's status, so a future change to what counts as "success" (e.g. also accepting 304) only needs
     * to be made in one place. */
    private static isSuccess(status: number): boolean {
        return status >= 200 && status < 300;
    }

    /**
     * Attempts to close the existing alert with the given identifier.
     * @param id The unique identifier of the alert to close.
     * @returns True if the operation was successful, otherwise false.
     */
    public async close(id: string, data: AlertClose = {}): Promise<boolean> {
        try {
            // Truncate into a copy rather than the caller's object, so `data` isn't silently modified out from
            // under a caller that reuses it after this call returns.
            const payload: AlertClose = { ...data };
            if (payload.note) {
                payload.note = payload.note.substring(0, MAX_CHARS_NOTE);
            }
            if (payload.source) {
                payload.source = payload.source.substring(0, MAX_CHARS_SOURCE);
            }

            const url: string = `${this.serviceUrl}/${encodeURIComponent(id)}/close`;
            const response: AxiosResponse = await axios.post(url, payload, {
                headers: {
                    Authorization: this.auth,
                }
            });
            return AlertUtils.isSuccess(response.status);
        } catch (err: any) {
            this.logger?.error("Failed to close alert with id " + id);
            this.logger?.error(err.message);
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
            const url: string = `${this.serviceUrl}/${encodeURIComponent(id)}`;
            const response: AxiosResponse = await axios.get(url, {
                headers: {
                    Authorization: this.auth,
                }
            });
            // axios's default validateStatus already rejects (throws) any non-2xx response before we get here, so
            // the alternate branch below is unreachable under normal operation; kept as defense in depth.
            return AlertUtils.isSuccess(response.status) ? response.data : /* v8 ignore next */ null;
        } catch (err: any) {
            this.logger?.error("Failed to retrieve alert with id " + id);
            this.logger?.error(err.message);
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
            // Substitute/truncate into a copy rather than the caller's `alert` object. `Alert` is a natural
            // template to define once and reuse across multiple send() calls with different `vars` - mutating it
            // in place would leave later calls with no "{{placeholder}}" left to substitute, since the first call
            // already overwrote them with the first call's resolved values.
            const payload: Alert = { ...alert };

            // Perform variable substitution on the alert's text fields *before* truncating them below. Note:
            // these fields are treated as plain data, never as a template to compile/execute, since
            // `description`/`message`/`note` frequently originate from untrusted event or exception text and
            // must not be interpretable as code.
            payload.description = StringUtils.findAndReplace(payload.description, vars);
            payload.message = StringUtils.findAndReplace(payload.message, vars);
            if (payload.note) {
                payload.note = StringUtils.findAndReplace(payload.note, vars);
            }

            // Truncate the various properties to the maximimum allowed by the most restrictive known API (e.g.
            // OpsGenie). Done *after* substitution above - substituting into an already-truncated string could
            // expand a short placeholder (e.g. a long exception message) past the API's limit, defeating the
            // truncation this is meant to guarantee.
            payload.alias = payload.alias.substring(0, MAX_CHARS_ALIAS);
            payload.description = payload.description.substring(0, MAX_CHARS_DESCRIPTION);
            if (payload.entity) {
                payload.entity = payload.entity.substring(0, MAX_CHARS_ENTITY);
            }
            payload.message = payload.message.substring(0, MAX_CHARS_MESSAGE);
            if (payload.note) {
                payload.note = payload.note.substring(0, MAX_CHARS_NOTE);
            }
            payload.source = payload.source.substring(0, MAX_CHARS_SOURCE);
            if (payload.tags) {
                let tags: string[] = [];
                for (let i = 0; i < Math.min(MAX_TAGS, payload.tags.length); i++) {
                    const tag: string = payload.tags[i];
                    tags.push(tag.substring(0, MAX_CHARS_TAGS));
                }
                payload.tags = tags;
            }

            let response: AxiosResponse = await axios.post(this.serviceUrl, payload, {
                headers: {
                    Authorization: this.auth,
                }
            });
            // axios's default validateStatus already rejects (throws) any non-2xx response before we get here, so
            // the alternate branch below is unreachable under normal operation; kept as defense in depth.
            const requestId: string | null = AlertUtils.isSuccess(response.status)
                ? response.data.requestId
                : /* v8 ignore next */ null;
            if (!requestId) {
                return null;
            }

            // Query the API for the final alert id
            let id: string | null = null;
            let count: number = 0;
            while (!id && count < MAX_ATTEMPTS) {
                try {
                    const url: string = `${this.serviceUrl}/requests/${encodeURIComponent(requestId)}`;
                    const response: AxiosResponse = await axios.get(url, {
                        headers: {
                            Authorization: this.auth,
                        }
                    });
                    if (response.data.success && response.data.alertId) {
                        id = response.data.alertId;
                    } else {
                        // Request accepted but not finished processing yet. Wait a second before retrying instead
                        // of hot-looping.
                        await sleep(1000);
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
                    // Upload each attachment individually and concurrently - they're independent uploads to
                    // different destinations, so there's no need to serialize them and pay N round-trips of
                    // latency on this alerting path where fast delivery matters most.
                    await Promise.all(
                        attachments.files.map((file) => this.addAttachment(id, file, attachments.indexFile)),
                    );
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

            let url: string = `${this.serviceUrl}/${encodeURIComponent(id)}/attachments`;
            if (indexFile) {
                url += "?indexFile=" + encodeURIComponent(indexFile);
            }
            const response: AxiosResponse = await axios.post(url, form, {
                headers: {
                    ...form.getHeaders(),
                    Authorization: this.auth
                }
            });

            return AlertUtils.isSuccess(response.status);
        } catch (err: any) {
            // Don't fail the rest of the request if attachments fail
            this.logger?.error(`Failed to upload attachment ${attachment.filename} to alert ${id}.`);
            this.logger?.error(err.response?.data?.message || err.message);
            return false;
        }
    }
}
