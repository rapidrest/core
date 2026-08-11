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
        ObjectUtils._deleteScopedProps(obj, user, clazz, recurse, new Set());
    }

    /**
     * Internal implementation of `deleteScopedProps` that tracks already-visited objects so that circular
     * references (e.g. ORM-populated relations that reference each other) don't cause infinite recursion.
     */
    private static _deleteScopedProps(obj: any, user: JWTUser | undefined, clazz: any, recurse: boolean | undefined, visited: Set<any>) {
        const objs: any[] = Array.isArray(obj) ? obj : [obj];
        for (const obj of objs) {
            // Track every object visited (Set works fine with primitives too, so no `typeof` guard is needed)
            // so a circular reference doesn't cause infinite recursion.
            if (visited.has(obj)) continue;
            visited.add(obj);

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

                // If recursion is requested, process the child object. `obj[member] !== null` is required since
                // `typeof null === "object"` in JS, and recursing into `null` would throw inside
                // `Object.getOwnPropertyNames`.
                if (recurse && obj[member] !== null && typeof obj[member] === "object") {
                    ObjectUtils._deleteScopedProps(obj[member], user, undefined, recurse, visited);
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
        ObjectUtils._validate(obj, clazz, recurse, new Set());
    }

    /**
     * Internal implementation of `validate` that tracks already-visited objects so that circular references
     * (e.g. ORM-populated relations that reference each other) don't cause infinite recursion.
     */
    private static _validate(obj: any, clazz: any, recurse: boolean | undefined, visited: Set<any>) {
        const objs: any[] = Array.isArray(obj) ? obj : [obj];
        for (const obj of objs) {
            // Track every object visited (Set works fine with primitives too, so no `typeof` guard is needed)
            // so a circular reference doesn't cause infinite recursion.
            if (visited.has(obj)) continue;
            visited.add(obj);

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

                // If recursion is requested validate the child object. `obj[member] !== null` is required since
                // `typeof null === "object"` in JS, and recursing into `null` would throw inside
                // `Object.getOwnPropertyNames`.
                if (recurse && obj[member] !== null && typeof obj[member] === "object") {
                    ObjectUtils._validate(obj[member], undefined, recurse, visited);
                }
            }
        }
    }
}
