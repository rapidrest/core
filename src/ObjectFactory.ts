///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import "reflect-metadata";
import { Logger } from "./Logger.js";
import * as uuid from "uuid";

/**
 * The set of options to use when creating new instances of objects.
 */
export interface InstanceOptions {
    args?: any[];
    name?: string;
    initialize?: boolean;
}

/**
 * The `ObjectFactory` is a manager for creating objects based on registered
 * class types. This allows for the tracking of multiple instances of objects
 * so that references can be referenced by unique name.
 *
 * @author Jean-Philippe Steinmetz
 */
export class ObjectFactory {
    /** A map for string fully qualified class names to their class types. */
    public readonly classes: Map<string, any> = new Map();

    /** The global application configuration object. */
    protected config: any;

    /** A map for the unique name to the intance of a particular class type. */
    public readonly instances: Map<string, any> = new Map();

    /** The application logging utility. */
    protected logger: any;

    constructor(config?: any, logger?: any) {
        this.config = config;
        this.logger = logger ? logger : Logger();
        // Add ourself so it can be injected/retrieved
        this.instances.set(`${ObjectFactory.name}:default`, this);
    }

    /**
     * Destroys the specified objects. If `undefined` is passed in, all objects managed by the factory are destroyed.
     */
    public async destroy(objs?: any | any[]): Promise<void> {
        // If no set of objects was provided we want to destroy everything
        if (!objs) {
            objs = [];
            this.instances.forEach((value, key) => {
                if (!value.name) {
                    value.name = key;
                }
                objs.push(value);
            });
        } else {
            // If only a single object was passed in we need to convert this to an array
            if (!Array.isArray(objs)) {
                objs = [objs];
            }
        }

        // Go through each object and call its destructor, if available
        for (const obj of objs) {
            const name: string = obj.name ?? obj._name;

            let destroyFunc: Function | undefined = undefined;
            let proto = Object.getPrototypeOf(obj);
            while (proto) {
                for (const member of Object.getOwnPropertyNames(proto)) {
                    const hasDestructor: boolean = Reflect.getMetadata("rrst:destructor", proto, member);
                    if (hasDestructor) {
                        destroyFunc = obj[member];
                        break;
                    }
                }

                if (destroyFunc) {
                    break;
                }
                proto = Object.getPrototypeOf(proto);
            }

            if (destroyFunc) {
                try {
                    this.logger.debug("Destroying object: " + name);
                    const boundFunc: Function = destroyFunc.bind(obj);
                    const result: any = boundFunc();
                    if (result instanceof Promise) {
                        await result;
                    }
                } catch (err) {
                    this.logger.error("Failed to destroy object: " + name);
                    this.logger.debug(err);
                }
            }
        }
    }

    /**
     * Deletes all instantiated objects.
     */
    public clear(): void {
        this.instances.clear();
    }

    /**
     * Deletes all instantiated objects and registered class types.
     */
    public clearAll(): void {
        this.clear();
        this.classes.clear();
    }

    /**
     * Scans the given object for any properties with the `@Inject` decorator and assigns the correct values.
     * @param obj The object to initialize with injected defaults
     */
    public async initialize<T>(obj: any): Promise<T> {
        let proto = Object.getPrototypeOf(obj);
        while (proto) {
            // Search for each type of injectable property
            for (const member of Object.getOwnPropertyNames(proto)) {
                // Inject @Config
                const injectConfig: any = Reflect.getMetadata("rrst:injectConfig", proto, member);
                if (injectConfig) {
                    const defaultValue: any = Reflect.getMetadata("rrst:injectConfigDefault", proto, member);
                    // If the value is a string, then it must be a path to a specific variable desired
                    if (typeof injectConfig === "string") {
                        const value: any = this.config?.get(injectConfig);
                        if (value !== undefined) {
                            obj[member] = value;
                        } else if (defaultValue !== undefined) {
                            obj[member] = defaultValue;
                        } else {
                            throw new Error("No configuration variable is defined at path: " + injectConfig);
                        }
                    } else {
                        // No specific variable is desired, inject the whole config object
                        obj[member] = this.config;
                    }
                }

                // Inject @Logger
                const injectLogger: any = Reflect.getMetadata("rrst:injectLogger", proto, member);
                if (injectLogger) {
                    obj[member] = this.logger;
                }

                // Inject @Inject
                const injectObject: any = Reflect.getMetadata("rrst:injectObject", proto, member);
                if (injectObject) {
                    // First register the type just in case it hasn't been done yet
                    this.register(injectObject.type);
                    // Now retrieve the instance for the given name
                    const instance: any = await this.newInstance(
                        injectObject.type,
                        injectObject.options
                    );
                    obj[member] = instance;
                }
            }

            proto = Object.getPrototypeOf(proto);
        }

        // Call any @Init functions
        const initFuncs: Function[] = this.getInitMethods(obj);
        for (const func of initFuncs) {
            const result: any = func.bind(obj)();
            if (result instanceof Promise) {
                await result;
            }
        }

        return obj;
    }

    /**
     * Searches an object for one or more functions that implement a `@Init` decorator.
     *
     * @param obj The object to search.
     * @returns The list of functions that implements the `@Init` decorator if found, otherwise undefined.
     */
    public getInitMethods(obj: any): Function[] {
        const results: Function[] = [];

        for (const member in obj) {
            const initialize: boolean = Reflect.getMetadata("rrst:initialize", obj, member);
            if (initialize) {
                results.push(obj[member]);
                break;
            }
        }

        let proto = Object.getPrototypeOf(obj);
        while (proto) {
            for (const member of Object.getOwnPropertyNames(proto)) {
                const initialize: boolean = Reflect.getMetadata("rrst:initialize", proto, member);
                if (initialize) {
                    results.push(obj[member]);
                    break;
                }
            }
            proto = Object.getPrototypeOf(proto);
        }

        return results;
    }

    /**
     * Returns the object instance with the given unique name. Unique names take the form `<ClassName>:<InstanceName>`.
     * It is possible to only specifiy the `<ClassName>`, doing so will automatically look for the `<ClassName>:default`
     * instance or the first found instance of the given type.
     * @param nameOrType The unique name or class type of the object to retrieve.
     * @returns The object instance associated with the given name if found, otherwise `undefined`.
     */
    // TODO: Investigate name vs fqn
    public getInstance<T>(nameOrType: any): T | undefined {
        let search: string = "";
        if (typeof nameOrType === "string") {
            search = nameOrType;
        } else {
            search =
                nameOrType && nameOrType.name
                    ? nameOrType.name
                    : nameOrType.constructor
                      ? nameOrType.constructor.name
                      : search;
        }

        // Make sure we have a valid type name
        if (!nameOrType) {
            throw new Error("No valid nameOrType was specified.");
        }

        // First search for the exact name or with `:default`
        let result: T = this.instances.get(search.includes(":") ? search : search + ":default");
        // If we didn't found a result and we weren't given an exact name to search, find the first
        // instance of the class.
        if (!result && !search.includes(":")) {
            for (const key of this.instances.keys()) {
                if (key.startsWith(search + ":")) {
                    result = this.instances.get(key);
                    break;
                }
            }
        }

        return result;
    }

    /**
     * Creates a new instance of the class specified with the provided unique name or type and constructor arguments. If an existing
     * object has already been created with the given name, that instance is returned, otherwise a new instance is created
     * using the provided arguments.
     *
     * @param type The fully qualified name or type of the class to instantiate. If a type is given it's class name will be inferred
     * via the constructor name.
     * @param name The unique name to give the class instance. Set to `undefined` if you wish to force a new object is created.
     * @param initialize Set to `true` to initialize the object after creation, otherwise set to `false`. Default is `true`.
     * @param args The set of constructor arguments to use during construction
     */
    public newInstance<T>(type: any, options?: InstanceOptions): T | Promise<T> {
        let name: string = options?.name || uuid.v4();
        const initialize: boolean = options?.initialize !== undefined ? options.initialize : true;
        const args: any[] = options?.args || [];

        // If an class type was given extract it's fqn
        const className = typeof type === "string" ? type : type.fqn || type.name || type.constructor.name;

        // Names are namespace specific by type. Prepend the type to the name if not already done.
        if (name && !name.includes(className)) {
            name = `${className}:${name}`;
        }

        // First check to see if an instance was already created for the given name
        if (name && this.instances.has(name)) {
            return this.instances.get(name);
        }

        // Make sure we have a valid type name
        if (!className) {
            throw new Error("No valid type was specified.");
        }

        // Make sure the class has been registered if a type was provided
        if (typeof type !== "string") {
            this.register(type);
        }

        // Look up the class type in our list
        const clazz: any = this.classes.get(className);
        if (!clazz || !clazz.constructor) {
            throw new Error("No class found with name: " + className);
        }

        // Create the new instance using the provided params
        this.logger.debug(`Creating new instance of class [${className}] with name [${name}]`);
        const instance: T = new clazz(...args);

        // Also store the fqn for reference
        Object.defineProperty(instance as any, "_fqn", {
            enumerable: false,
            writable: false,
            value: className,
        });

        // Store the instance in our list of objects
        if (name) {
            // Save the name to the object
            Object.defineProperty(instance as any, "_name", {
                enumerable: false,
                writable: false,
                value: name,
            });

            this.instances.set(name, instance);
        }

        // Now initialize the object with any injectable defaults. This must happen after we add the instance
        // to our internal map so that circular dependencies due not cause endless cycles of creation/initialization.
        if (initialize) {
            return this.initialize(instance);
        }

        return instance;
    }

    /**
     * Registers the given class type for the provided fully qualified name.
     * @param clazz The class type to register.
     * @param fqn The fully qualified name of the class to register. If not specified, the class name will be used.
     */
    public register(clazz: any, fqn?: string): void {
        const name: string = fqn ? fqn : clazz.fqn || clazz.name;
        if (!name) {
            this.logger.info(`Unable to register class ${name} for ${clazz}/${fqn}`);
            return;
        }
        if (!this.classes.has(name)) {
            this.logger.info(`Registering class ${name}`);
            this.classes.set(name, clazz);
        }
    }
}
