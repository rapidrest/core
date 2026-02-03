import { StringUtils } from "./StringUtils.js";

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
            // NO-OP 
        }
        Object.setPrototypeOf(this, ApiError.prototype);
    }
}