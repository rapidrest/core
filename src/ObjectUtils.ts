///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import "reflect-metadata";
import { ValidatorFunction } from "./decorators/ObjectDecorators.js";
import { JWTUser } from "./JWTUtils.js";
import { UserUtils } from "./UserUtils.js";

/**
 * Utility class for working with objects.
 *
 * @author Jean-Philippe Steinmetz
 */
export class ObjectUtils {
    /**
     * Deletes all properties from the given object(s) that the specified user does not have scope to read.
     *
     * @param obj The object(s) to process.
     * @param user The user whose scope permissions will be tested.
     * @param clazz The class type that contains the @RequiresScope metadata.
     * @param recurse Set to `true` to validate all child objects.
     */
    public static deleteScopedProps(obj: any, user?: JWTUser, clazz?: any, recurse?: boolean) {
        const objs: any[] = Array.isArray(obj) ? obj : [obj];
        for (const obj of objs) {
            const metadataObj: any = !clazz || obj instanceof clazz ? obj : new clazz();

            // Iterate through all properties of the object
            for (const member of Object.getOwnPropertyNames(obj)) {
                if (member === "constructor") continue;

                // Extract the list of required scopes for the property
                const scopes: string[] | undefined = Reflect.getMetadata("rrst:scopes", metadataObj, member);

                // If the user does not have at least one of the specified scopes, delete the property from the object.
                if (scopes && !UserUtils.hasScopes(user, scopes)) {
                    delete obj[member];
                }

                // If recursion is requested, process the child object
                if (recurse && typeof obj[member] === "object") {
                    ObjectUtils.deleteScopedProps(obj[member], user, undefined, recurse);
                }
            }
        }
    }

    /**
     * Performs validation of the given object or array. Validation is performed by scanning the object class for properties
     * decorated with `@Validator` and executing the provided validation function.
     *
     * @param obj The object or array of objects to validate.
     * @param clazz The class type that contains the validation metadata.
     * @param recurse Set to `true` to validate all child objects.
     */
    public static validate(obj: any, clazz?: any, recurse?: boolean) {
        const objs: any[] = Array.isArray(obj) ? obj : [obj];
        for (const obj of objs) {
            const metadataObj: any = !clazz || obj instanceof clazz ? obj : new clazz();

            // Iterate through all properties of the object
            for (const member of Object.getOwnPropertyNames(obj)) {
                if (member === "constructor") continue;

                const nullable: any = Reflect.getMetadata("rrst:nullable", metadataObj, member);
                // Value of '0' is valid. Don't throw on such values.
                if (!nullable && (obj[member] === null || obj[member] === undefined || obj[member] === "")) {
                    throw new Error(`Property ${member} cannot be null.`);
                }

                const validator: ValidatorFunction | undefined = Reflect.getMetadata(
                    "rrst:validator",
                    metadataObj,
                    member,
                );
                if (validator && obj[member]) {
                    try {
                        obj[member] = validator(obj[member]);
                    } catch (err: any) {
                        throw new Error(`Property ${member} is invalid. ${err.message}`);
                    }
                }

                // If recursion is requested validate the child object
                if (recurse && typeof obj[member] === "object") {
                    ObjectUtils.validate(obj[member], recurse);
                }
            }
        }
    }
}
