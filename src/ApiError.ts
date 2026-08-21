///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
// SPDX-License-Identifier: MPL-2.0
///////////////////////////////////////////////////////////////////////////////
import { Logger } from "./Logger.js";
import { StringUtils } from "./StringUtils.js";

const logger = Logger();

/**
 * Describes an error that originates from a API service. This class extends the standard `Error` class to include
 * a unique code that can be used to trace an error to source code as well as the HTTP response status returned with
 * the error.
 */
export class ApiError extends Error {
    /** The unique code of the error. */
    public code: string;
    /** The HTTP status associated with the error. */
    public status: number;

    public ApiMessageTemplate(message: string | undefined, templateVariables?: any): string {
        if (!message) {
            return "";
        }
        if (message && templateVariables) {
            return StringUtils.findAndReplace(message, templateVariables);
        }
        return message;
    }

    constructor(code: string, status: number, message?: string, templateVariables?: any) {
        super(message);
        this.code = code;
        this.status = status;
        try {
            this.message = this.ApiMessageTemplate(message, templateVariables);
        } catch (error) {
            // Falls back to the raw, unsubstituted `message` (already set via `super(message)` above) rather
            // than propagating - a malformed template/templateVariables shouldn't prevent the error itself from
            // being constructed and thrown. Logged rather than silently swallowed so a caller-supplied template
            // bug is still discoverable.
            logger.warn(`Failed to apply template variables to ApiError message: ${code}`);
            logger.debug(error);
        }
        Object.setPrototypeOf(this, ApiError.prototype);
    }
}
