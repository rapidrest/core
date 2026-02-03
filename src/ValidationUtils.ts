///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import validator from "validator";

/**
 * A simple validation function that returns a boolean success or fail.
 */
export type BooleanFunc = (val: any) => boolean;

/**
 * A collection of validation functions to use with the `@Validator()` decorator.
 */
export class ValidationUtils {
    /**
     * A simple wrapper that calls the specified boolean validation function with the given value and returns the
     * value as a result if the validation function passes. Otherwise throws an error.
     * 
     * @param val The value to validate.
     * @param func The boolean validation function to check the value.
     * @throws Throws an error if the value fails the boolean validation test.
     */
    public static check(val: any, func: BooleanFunc): any {
        if (!func(val)) {
            throw new Error(`Value failed validation: ${func.name}`);
        }
        return val;
    }

    /**
     * Validates that the provided string represents a ISO, RFC or UTC date or timestamp.
     */
    public static checkDate(val: string): string {
        if (!validator.isDate(val)) {
            throw new Error("Value is not a Date.");
        }
        return val;
    }

    /**
     * Validates that the provided string represents a valid e-mail address.
     */
    public static checkEmail(val: string): string {
        if (!validator.isEmail(val)) {
            throw new Error("Value is not a valid email addresss.");
        }
        return val;
    }

    /**
     * Validates that the provided array is not empty.
     */
    public static checkEmpty(val: Array<any>): Array<any> {
        if (val && val.length === 0) {
            throw new Error("Value cannot be empty.");
        }
        return val;
    }

    /**
     * Validates that the provided string is a valid IP address.
     */
    public static checkIP(val: string): string {
        if (!validator.isIP(val)) {
            throw new Error("Value is not a valid IP address.");
        }
        return val;
    }

    /**
     * Validates that the provided string is valid JSON (note: uses `JSON.parse`).
     */
    public static checkJSON(val: string): string {
        if (!validator.isJSON(val)) {
            throw new Error("Value is not valid JSON.");
        }
        return val;
    }

    /**
     * Validates that the provided string matches the regexp pattern /[a-zA-Z0-9_\-\.@:\+]+/.
     */
    public static checkName(val: string): string {
        if (!/[a-zA-Z0-9_\-]+/.test(val)) {
            throw new Error("Value is not a name matching pattern /[a-zA-Z0-9_\-\.@:\+]+/");
        }
        return val;
    }

    /**
     * Validates that the provided object is not null or empty.
     */
    public static checkNull(val: any): any {
        if (typeof val !== "boolean" && !val) {
            throw new Error("Value cannot be null.");
        }
        return val;
    }

    /**
     * Validates that the provided string represents a valid phone number.
     */
    public static checkPhone(val: string): string {
        if (!validator.isMobilePhone(val)) {
            throw new Error("Value is not a valid phone number.");
        }
        return val;
    }

    /**
     * Validates that the provided string represents a semantic version.
     */
    public static checkSemVer(val: string): string {
        if (!validator.isSemVer(val)) {
            throw new Error("Value is not a valid semantic version.");
        }
        return val;
    }

    /**
     * Validates that the provided string is a valid URL.
     */
    public static checkURL(val: string): string {
        if (!validator.isURL(val)) {
            throw new Error("Value is not a URL.");
        }
        return val;
    }

    /**
     * Validates that the provided string is a valid UUID.
     */
    public static checkUUID(val: string): string {
        if (!validator.isUUID(val)) {
            throw new Error("Value is not a UUID.");
        }
        return val;
    }

    /**
     * Validates that the provided value is an entity `version` number (e.g. `value > 0`).
     */
    public static checkVersion(val: any): number {
        const num: number = Number(val);
        return Math.max(num, 0);
    }
}