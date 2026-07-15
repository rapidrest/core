///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import "reflect-metadata";
import { InstanceOptions } from "../ObjectFactory.js";

/**
 * Apply this to a class function to mark it as a destructor to be called by the `ObjectFactory` during cleanup.
 */
export function Destroy(target: any, propertyKey: string) {
    Reflect.defineMetadata("rrst:destructor", true, target, propertyKey);
}

/**
 * Injects an object instance to the decorated property of the given name and type using the provided arguments
 * if no object has been created yet.
 * @param type The fully qualified name or type of the class to instantiate. If a type is given it's class name will be inferred
 * via the constructor name.
 * @param options The set of options to use when creating new instances of the injected class type.
 */
export function Inject(type: any, options?: InstanceOptions) {
    return function (target: any, propertyKey: string | symbol) {
        options = {
            ...options,
            name: options?.name || "default",
        };
        Reflect.defineMetadata(
            "rrst:injectObject",
            {
                options,
                type,
            },
            target,
            propertyKey,
        );
        Object.defineProperty(target, propertyKey, {
            enumerable: true,
            writable: true,
            value: undefined,
        });
    };
}

/**
 * Apply this to a function to be executed once a new object instance has been created and all dependencies injected.
 * Note: If the decorated function returns a Promise it is not gauranteed to finish execution before the object is
 * returned during the instantiation process.
 */
export function Init(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata("rrst:initialize", true, target, propertyKey);
}

/**
 * Apply this to a property to have a configuration variable be injected at instantiation. If no path is given, the
 * global configuration object is injected.
 *
 * @param path The path to the configuration variable to inject.
 * @param defaultValue Set to the desired default value. If `undefined` is specified then an error is thrown if
 * no config variable is found at the given path.
 */
export function Config(path?: string, defaultValue: any = undefined) {
    return function (target: any, propertyKey: string | symbol) {
        Reflect.defineMetadata("rrst:injectConfig", path ? path : true, target, propertyKey);
        Reflect.defineMetadata("rrst:injectConfigDefault", defaultValue, target, propertyKey);
        const key = `__${String(propertyKey)}`;
        Object.defineProperty(target, propertyKey, {
            enumerable: true,
            writable: true,
            value: undefined,
        });
    };
}

/**
 * Apply this to a property to have the logger utility injected at instantiation.
 */
export function Logger(target: any, propertyKey: string | symbol) {
    Reflect.defineMetadata("rrst:injectLogger", true, target, propertyKey);
    const key = `__${String(propertyKey)}`;
    Object.defineProperty(target, propertyKey, {
        enumerable: true,
        writable: true,
        value: undefined,
    });
}

/**
 * Apply this to a property to indicate that the value can be `null` or `undefined.`
 */
export function Nullable(target: any, propertyKey: string | symbol) {
    Reflect.defineMetadata("rrst:nullable", true, target, propertyKey);
}

/**
 * A function used to validate a property value.
 *
 * @param value The value to validate.
 * @returns The validated value to assign to the property.
 * @throws An exception if the value cannot be validated.
 */
export type ValidatorFunction = (value: any) => any;

/**
 * Indicates that the client's token must carry at least one of the specified OAuth-style scope(s) to have read access
 * to the decorated property. When a client does not have the defined scope the property is removed from the final object
 * construction.
 *
 * @param scope The scope that the authenticated user's token must carry to read the property.
 */
export function RequiresScope(scope: string | string[]) {
    return function (target: any, propertyKey: string | symbol) {
        const scopes: string[] = Array.isArray(scope) ? scope : [scope];
        Reflect.defineMetadata("rrst:scopes", scopes, target, propertyKey);
    };
}

/**
 * Apply this to a property to specify the function that will be used to perform validation of the value.
 *
 * @param func The validation function to use for the given property.
 */
export function Validator(func: ValidatorFunction) {
    return function (target: any, propertyKey: string | symbol) {
        Reflect.defineMetadata("rrst:validator", func, target, propertyKey);
    }
}
