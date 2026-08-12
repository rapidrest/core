///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import config from "./config.js";
import { ObjectFactory } from "../src/ObjectFactory.js";
import { Inject, Destroy, Config, Init, Logger as LoggerDecorator } from "../src/decorators/ObjectDecorators.js";
import { Logger } from "../src/Logger.js";
import { sleep } from "../src/sleep.js";
import { CircularClassA } from "./factory/CircularClassA.js";
import { CircularClassB } from "./factory/CircularClassB.js";
import { ClassC } from "./factory/ClassC.js";
import { ClassD } from "./factory/ClassD.js";
import { v4 as uuidV4 } from "uuid";
import { Writable } from "stream";
import winston from "winston";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
class TestClassA {
    @Destroy
    public destroy(): void {
        // no-op
    }
}

class TestClassConfigWithDefault {
    @Config("does:not:exist:path", "myDefaultValue")
    public withDefault?: string;
}

class TestClassConfigResolved {
    @Config("auth:secret")
    public secret?: string;
}

class TestClassConfigNoDefault {
    @Config("does:not:exist:path:2")
    public noDefault?: string;
}

class TestClassConfigWhole {
    @Config()
    public wholeConfig?: any;
}

class TestClassWithLogger {
    @LoggerDecorator
    public logger?: any;
}

class TestClassLoggerOutput {
    @LoggerDecorator
    public logger?: any;

    public doWork(): void {
        this.logger.info("Listening on 0.0.0.0:3000...");
    }
}

class AsyncInitClass {
    public initialized = false;
    @Init
    private async init() {
        await sleep(10);
        this.initialized = true;
    }
}

class AsyncFailingInitClass {
    @Init
    private async init() {
        await sleep(10);
        throw new Error("async init failed");
    }
}

class InjectsAsyncClass {
    @Inject(AsyncInitClass, { name: "default" })
    public dep?: AsyncInitClass;
}

class InjectsFailingAsyncClass {
    @Inject(AsyncFailingInitClass, { name: "default" })
    public dep?: AsyncFailingInitClass;
}

class ThrowingDestroyClass {
    @Destroy
    public destroy(): void {
        throw new Error("destroy failed");
    }
}

class TestClassB {
    public arg1: string;
    public arg2: number;

    constructor(arg1: string, arg2: number) {
        this.arg1 = arg1;
        this.arg2 = arg2;
    }

    @Destroy
    public async destroy(): Promise<void> {
        this.arg1 = "";
        this.arg2 = -1;
    }
}

class TestClassC {
    @Inject(TestClassA)
    public dep?: TestClassA;

    constructor() {
        // no-op
    }

    @Destroy
    public async destroy(): Promise<void> {
        this.dep = undefined;
    }
}

describe("ObjectFactory Tests", () => {
    const factory: ObjectFactory = new ObjectFactory(config, Logger());

    beforeEach(() => {
        factory.register(TestClassA);
        factory.register(TestClassB, TestClassB.name);
        factory.register(TestClassC);
        factory.register(CircularClassA);
        factory.register(CircularClassB);
    });

    afterEach(async () => {
        await factory.destroy();
        factory.clear();
    });

    it("Can create new class instances by name.", async () => {
        const instance: TestClassA = await factory.newInstance(TestClassA.name, { name: "myInstance" });
        expect(instance).toBeDefined();
        expect(instance).toBeInstanceOf(TestClassA);
        expect(instance).toHaveProperty("_name");
        expect(instance["_name"]).toBe(`${TestClassA.name}:myInstance`);
        expect(instance).toHaveProperty("_fqn");
        expect(instance["_fqn"]).toBe(TestClassA.name);
    });

    it("Can create new class instances by type.", async () => {
        const instance: TestClassA = await factory.newInstance(TestClassA, { name: "myInstance" });
        expect(instance).toBeDefined();
        expect(instance).toBeInstanceOf(TestClassA);
        expect(instance["_name"]).toBe(`${TestClassA.name}:myInstance`);
        expect(instance).toHaveProperty("_fqn");
        expect(instance["_fqn"]).toBe(TestClassA.name);
    });

    it("Can create new default class instances by name with circular dependencies.", async () => {
        const instance: CircularClassA = await factory.newInstance(CircularClassA.name, { name: "default" });
        expect(instance).toBeDefined();
        expect(instance).toBeInstanceOf(CircularClassA);

        const dep: CircularClassB | undefined = factory.getInstance(CircularClassB);
        expect(dep).toBeDefined();
    });

    it("Can create new default class instances by type with circular dependencies.", async () => {
        const instance: CircularClassB = await factory.newInstance(CircularClassB, { name: "default" });
        expect(instance).toBeDefined();
        expect(instance).toBeInstanceOf(CircularClassB);

        const dep: CircularClassA | undefined = factory.getInstance(CircularClassA);
        expect(dep).toBeDefined();
    });

    it("Can create new instance with constructor arguments.", async () => {
        const num: number = Math.floor(Math.random() * 1000);
        const instance: ClassC = await factory.newInstance(ClassC, { name: "default", initialize: true, args: [num] });
        expect(instance).toBeDefined();
        expect(instance.myProp).toEqual(num);
    });

    it("Can create new instance with constructor arguments passed via @Inject.", async () => {
        const instance: ClassD = await factory.newInstance(ClassD, { name: "default" });
        expect(instance).toBeDefined();
        expect(instance.injected).toBeDefined();
        expect(instance.injected?.myProp).toEqual(64);
    });

    it("Can initialize existing objects.", async () => {
        const instance2: TestClassC = new TestClassC();
        await factory.initialize(instance2);
        expect(instance2.dep).toBeDefined();
        expect(instance2.dep).toBeInstanceOf(TestClassA);
    });

    it("Can create new class instances with constructor arguments.", async () => {
        const instance: TestClassB = await factory.newInstance(TestClassB.name, {
            name: "myInstance",
            initialize: true,
            args: ["hello", 1],
        });
        expect(instance).toBeDefined();
        expect(instance).toBeInstanceOf(TestClassB);
        expect(instance.arg1).toBe("hello");
        expect(instance.arg2).toBe(1);
    });

    it("Can force creation of new class instances.", async () => {
        const instance: TestClassB = await factory.newInstance(TestClassB.name, {
            name: "myInstance",
            initialize: true,
            args: ["hello", 1],
        });
        expect(instance).toBeDefined();
        expect(instance).toBeInstanceOf(TestClassB);
        expect(instance.arg1).toBe("hello");
        expect(instance.arg2).toBe(1);

        const instance2: TestClassB = await factory.newInstance(TestClassB.name, {
            name: uuidV4(),
            initialize: true,
            args: ["world", 100],
        });
        expect(instance2).toBeDefined();
        expect(instance2).toBeInstanceOf(TestClassB);
        expect(instance2.arg1).toBe("world");
        expect(instance2.arg2).toBe(100);
    });

    it("Can retrieve existing class instances by name.", async () => {
        const instance: TestClassA = await factory.newInstance(TestClassA.name, { name: "myInstance" });
        expect(instance).toBeDefined();
        expect(instance).toBeInstanceOf(TestClassA);

        const instance2: TestClassA = await factory.newInstance(TestClassA.name, { name: "myInstance" });
        expect(instance2).toBeDefined();
        expect(instance2).toBeInstanceOf(TestClassA);
        expect(instance).toBe(instance2);

        const instance3: TestClassA | undefined = factory.getInstance("TestClassA:myInstance");
        expect(instance3).toBeDefined();
        expect(instance3).toBeInstanceOf(TestClassA);
        expect(instance).toBe(instance3);
    });

    it("Can retrieve existing class instances by type.", async () => {
        const instance: TestClassA = await factory.newInstance(TestClassA, { name: "default" });
        expect(instance).toBeDefined();
        expect(instance).toBeInstanceOf(TestClassA);

        const instance2: TestClassA | undefined = factory.getInstance(TestClassA);
        expect(instance2).toBeDefined();
        expect(instance2).toBeInstanceOf(TestClassA);
        expect(instance).toBe(instance2);

        const instance3: TestClassA | undefined = factory.getInstance("TestClassA:default");
        expect(instance3).toBeDefined();
        expect(instance3).toBeInstanceOf(TestClassA);
        expect(instance).toBe(instance3);
    });

    it("Can retrieve first class instances by <type>:default.", async () => {
        const instance: TestClassA = await factory.newInstance(TestClassA);
        expect(instance).toBeDefined();
        expect(instance).toBeInstanceOf(TestClassA);

        const instance2: TestClassA | undefined = factory.getInstance(TestClassA);
        expect(instance2).toBeDefined();
        expect(instance2).toBeInstanceOf(TestClassA);
        expect(instance).toBe(instance2);
    });

    it("Can retrieve existing class instances by type <name>:default.", async () => {
        const instance: TestClassA = await factory.newInstance(TestClassA, { name: "default" });
        expect(instance).toBeDefined();
        expect(instance).toBeInstanceOf(TestClassA);

        const instance2: TestClassA | undefined = factory.getInstance(TestClassA.name);
        expect(instance2).toBeDefined();
        expect(instance2).toBeInstanceOf(TestClassA);
        expect(instance).toBe(instance2);

        const instance3: TestClassA | undefined = factory.getInstance("TestClassA:default");
        expect(instance3).toBeDefined();
        expect(instance3).toBeInstanceOf(TestClassA);
        expect(instance).toBe(instance3);
    });

    it("Can retrieve first class instances by type name.", async () => {
        const instance: TestClassA = await factory.newInstance(TestClassA);
        expect(instance).toBeDefined();
        expect(instance).toBeInstanceOf(TestClassA);

        const instance2: TestClassA | undefined = factory.getInstance(TestClassA.name);
        expect(instance2).toBeDefined();
        expect(instance2).toBeInstanceOf(TestClassA);
        expect(instance).toBe(instance2);
    });

    it("getInstance by type still finds a surviving instance after the 'first' instance of that class is destroyed.", async () => {
        const instanceA: TestClassA = await factory.newInstance(TestClassA, { name: "a" });
        const instanceB: TestClassA = await factory.newInstance(TestClassA, { name: "b" });
        expect(factory.getInstance(TestClassA)).toBe(instanceA);

        await factory.destroy(instanceA);

        // `instanceB` is still alive in the factory; getInstance-by-type must fall through to it instead of
        // returning undefined just because the original "first" instance for the class was destroyed.
        expect(factory.getInstance(TestClassA)).toBe(instanceB);

        await factory.destroy(instanceB);
        expect(factory.getInstance(TestClassA)).toBeUndefined();
    });

    it("Can call destory on class instance and all instances.", async () => {
        const testClassBInstance: TestClassB = await factory.newInstance(TestClassB, {
            name: "default",
            initialize: true,
            args: ["construct"],
        });
        expect(testClassBInstance).toBeDefined();
        expect(testClassBInstance).toBeInstanceOf(TestClassB);
        expect(testClassBInstance.arg1).toBe("construct");
        await factory.destroy(testClassBInstance);
        expect(testClassBInstance.arg1).toBe("");
        factory.clear();

        const testClassBInstance2: TestClassB = await factory.newInstance(TestClassB, {
            name: "default",
            initialize: true,
            args: ["construct"],
        });
        expect(testClassBInstance2).toBeDefined();
        expect(testClassBInstance2).toBeInstanceOf(TestClassB);
        expect(testClassBInstance2.arg1).toBe("construct");
        await factory.destroy();
        expect(testClassBInstance2.arg1).toBe("");
    });

    it("Uses a default Logger when none is provided to the constructor.", async () => {
        const localFactory = new ObjectFactory(config);
        localFactory.register(TestClassA);
        const instance: any = await localFactory.newInstance(TestClassA, { name: "default" });
        expect(instance).toBeInstanceOf(TestClassA);
        localFactory.clear();
    });

    it("destroy() accepts an array of objects.", async () => {
        const a: any = await factory.newInstance(TestClassA, { name: "arrA" });
        const b: any = await factory.newInstance(TestClassA, { name: "arrB" });
        await expect(factory.destroy([a, b])).resolves.toBeUndefined();
    });

    it("destroy() uses _name when the object has no name property, and logs via the provided logger.", async () => {
        const stubLogger = { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };
        const localFactory = new ObjectFactory(config, stubLogger);
        localFactory.register(TestClassA);
        const instance: any = await localFactory.newInstance(TestClassA, { name: "myInstance" });
        expect(instance.name).toBeUndefined();
        expect(instance._name).toBe("TestClassA:myInstance");

        await localFactory.destroy(instance);
        expect(stubLogger.debug).toHaveBeenCalledWith(expect.stringContaining("TestClassA:myInstance"));
        localFactory.clear();
    });

    it("destroy() catches and logs when the destructor throws.", async () => {
        const stubLogger = { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };
        const localFactory = new ObjectFactory(config, stubLogger);
        localFactory.register(ThrowingDestroyClass);
        const instance = await localFactory.newInstance(ThrowingDestroyClass, { name: "default" });

        await expect(localFactory.destroy(instance)).resolves.toBeUndefined();
        expect(stubLogger.error).toHaveBeenCalledWith(expect.stringContaining("Failed to destroy object"));
        localFactory.clear();
    });

    it("destroy(instance) removes the instance from the map so a later newInstance() with the same name builds a fresh one.", async () => {
        const localFactory = new ObjectFactory(config, Logger());
        localFactory.register(TestClassB);
        const first: TestClassB = await localFactory.newInstance(TestClassB, {
            name: "default",
            args: ["construct", 1],
        });

        await localFactory.destroy(first);
        expect(localFactory.instances.has("TestClassB:default")).toBe(false);

        const second: TestClassB = await localFactory.newInstance(TestClassB, {
            name: "default",
            args: ["construct", 1],
        });
        expect(second).not.toBe(first);
        expect(second.arg1).toBe("construct");
        localFactory.clear();
    });

    it("destroy() with no arguments removes every managed instance but keeps the factory's own self-registration.", async () => {
        const localFactory = new ObjectFactory(config, Logger());
        localFactory.register(TestClassA);
        await localFactory.newInstance(TestClassA, { name: "toBeDestroyed" });

        await localFactory.destroy();

        expect(localFactory.instances.has("TestClassA:toBeDestroyed")).toBe(false);
        expect(localFactory.getInstance(ObjectFactory)).toBe(localFactory);
        localFactory.clear();
    });

    it("destroy() does not overwrite an existing .name property when destroying all instances.", async () => {
        const localFactory = new ObjectFactory(config, Logger());
        const preNamed: any = { name: "already-named" };
        localFactory.instances.set("preNamed", preNamed);

        await localFactory.destroy();

        expect(preNamed.name).toBe("already-named");
        localFactory.clear();
    });

    it("clearAll removes all instances and registered classes.", async () => {
        const localFactory = new ObjectFactory(config, Logger());
        localFactory.register(TestClassA);
        await localFactory.newInstance(TestClassA, { name: "toBeCleared" });
        expect(localFactory.classes.has("TestClassA")).toBe(true);
        expect(localFactory.instances.size).toBeGreaterThan(0);

        localFactory.clearAll();
        expect(localFactory.classes.size).toBe(0);
        expect(localFactory.instances.size).toBe(0);
    });

    it("initialize() uses the resolved @Config value when present.", async () => {
        const instance: any = await factory.newInstance(TestClassConfigResolved, { name: "default" });
        expect(instance.secret).toBe("MyPasswordIsSecure");
    });

    it("initialize() uses the @Config default when the config path is missing.", async () => {
        const instance: any = await factory.newInstance(TestClassConfigWithDefault, { name: "default" });
        expect(instance.withDefault).toBe("myDefaultValue");
    });

    it("initialize() throws when a @Config path is missing and no default is provided.", () => {
        expect(() => factory.newInstance(TestClassConfigNoDefault, { name: "default" })).toThrow(
            "No configuration variable is defined at path:",
        );
    });

    it("initialize() injects the whole config object for a bare @Config().", async () => {
        const instance: any = await factory.newInstance(TestClassConfigWhole, { name: "default" });
        expect(instance.wholeConfig).toBe(config);
    });

    it("initialize() injects the logger for a @Logger-decorated property.", async () => {
        const instance: any = await factory.newInstance(TestClassWithLogger, { name: "default" });
        expect(instance.logger).toBeDefined();
        // newInstance() always assigns an instance _fqn, so the injected logger should be an fqn-bound child
        // logger rather than the factory's raw shared logger instance.
        expect(instance.logger).not.toBe((factory as any).logger);
    });

    it("initialize() injects the factory's raw logger (not an fqn-bound child) for an object with no _fqn.", async () => {
        const instance = new TestClassWithLogger();
        await factory.initialize(instance);
        expect(instance.logger).toBe((factory as any).logger);
    });

    it("A @Logger-decorated instance logs with a [_fqn.method] prefix derived from its ObjectFactory _fqn.", async () => {
        // Capture the fully-formatted output by attaching an extra Stream transport to the real logger, rather
        // than trying to intercept console/stdout (which winston/Node bind in ways that don't play well with
        // spies under Vitest's test environment).
        const chunks: string[] = [];
        const captureStream = new Writable({
            write(chunk, _encoding, callback) {
                chunks.push(chunk.toString());
                callback();
            },
        });
        const logger = Logger();
        const captureTransport = new winston.transports.Stream({ stream: captureStream });
        logger.add(captureTransport);
        try {
            const localFactory = new ObjectFactory(config, logger);
            localFactory.register(TestClassLoggerOutput);
            const instance: TestClassLoggerOutput = await localFactory.newInstance(TestClassLoggerOutput, {
                name: "default",
            });
            instance.doWork();

            const output = chunks.join("");
            expect(output).toContain(`[${TestClassLoggerOutput.name}.doWork] `);
            expect(output).toContain("Listening on 0.0.0.0:3000...");
        } finally {
            logger.remove(captureTransport);
        }
    });

    it("Successfully injects a dependency whose own initialization is asynchronous.", async () => {
        const instance: any = await factory.newInstance(InjectsAsyncClass, { name: "default" });
        await sleep(100);
        expect(instance.dep).toBeDefined();
        expect(instance.dep.initialized).toBe(true);
    });

    it("A class with an async @Init method that throws rejects newInstance's returned promise.", async () => {
        await expect(factory.newInstance(AsyncFailingInitClass, { name: "default" })).rejects.toThrow(
            "async init failed",
        );
    });

    it("Logs and swallows a rejected @Inject dependency instantiation instead of throwing.", async () => {
        const stubLogger = { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };
        const localFactory = new ObjectFactory(config, stubLogger);
        localFactory.register(AsyncFailingInitClass);
        localFactory.register(InjectsFailingAsyncClass);

        const instance: any = await localFactory.newInstance(InjectsFailingAsyncClass, { name: "default" });
        expect(instance).toBeDefined();

        await sleep(100);
        expect(stubLogger.error).toHaveBeenCalledWith(expect.stringContaining("Failed to instantiate dependency"));
        expect(stubLogger.debug).toHaveBeenCalled();

        await localFactory.destroy();
        localFactory.clear();
    });

    it("getInitMethods finds an @Init method declared on a class.", async () => {
        const instance = await factory.newInstance(AsyncInitClass, { name: "forGetInitMethods" });
        const results = factory.getInitMethods(instance);
        expect(results.length).toBeGreaterThan(0);
    });

    it("getInitMethods returns an empty array for a class with no @Init methods.", async () => {
        const instance = await factory.newInstance(TestClassA, { name: "noInitMethods" });
        const results = factory.getInitMethods(instance);
        expect(results).toEqual([]);
    });

    it("getInitMethods finds an init method declared directly on a plain object instance.", () => {
        const obj: any = { someMethod: () => undefined };
        Reflect.defineMetadata("rrst:initialize", true, obj, "someMethod");
        const results = factory.getInitMethods(obj);
        expect(results).toContain(obj.someMethod);
    });

    it("getInitMethods does not report the same @Init method twice when it's visible via both the own-property and prototype-chain scans.", () => {
        class DedupInitClass {
            @Init
            private init(): void {
                // no-op
            }
        }
        const instance: any = new DedupInitClass();
        // Shadow the prototype method with an own enumerable property of the same name (and metadata) so the
        // own-property scan finds "init" first; the class's own @Init metadata on the prototype would otherwise
        // cause the prototype-chain scan to report it again.
        Reflect.defineMetadata("rrst:initialize", true, instance, "init");
        instance.init = instance.init.bind(instance);

        const results = factory.getInitMethods(instance);
        expect(results.filter((fn) => fn === instance.init)).toHaveLength(1);
    });

    it("newInstance with initialize:false skips @Config/@Inject/@Init processing.", () => {
        const instance: any = factory.newInstance(TestClassC, { name: "noInit", initialize: false });
        expect(instance instanceof Promise).toBe(false);
        expect(instance).toBeInstanceOf(TestClassC);
        expect(instance.dep).toBeUndefined();
    });

    it("newInstance does not double-prefix a name that already includes the class name.", async () => {
        const instance: any = await factory.newInstance(TestClassA, { name: "TestClassA:custom" });
        expect(instance._name).toBe("TestClassA:custom");
    });

    it("newInstance falls back to type.constructor.name when given an instance rather than a class.", async () => {
        const instance: any = await factory.newInstance(new TestClassA(), { name: "viaInstance" });
        expect(instance).toBeInstanceOf(TestClassA);
        expect(instance._name).toBe("TestClassA:viaInstance");
    });

    it("newInstance throws when given an empty string type.", () => {
        expect(() => factory.newInstance("")).toThrow("No valid type was specified.");
    });

    it("newInstance throws when given a null/undefined type.", () => {
        expect(() => factory.newInstance(null)).toThrow("No valid type was specified.");
        expect(() => factory.newInstance(undefined)).toThrow("No valid type was specified.");
    });

    it("newInstance throws when no class is registered for the given name.", () => {
        expect(() => factory.newInstance("NeverRegisteredClassXYZ")).toThrow("No class found with name:");
    });

    it("getInstance resolves the search name from an instance via constructor.name.", async () => {
        const created: any = await factory.newInstance(TestClassA, { name: "default" });
        const found: any = factory.getInstance(new TestClassA());
        expect(found).toBe(created);
    });

    it("getInstance returns undefined for an object with no name and no constructor.", () => {
        const weird = Object.create(null);
        expect(factory.getInstance(weird)).toBeUndefined();
    });

    it("getInstance returns undefined for a class name that was never instantiated.", () => {
        expect(factory.getInstance("NeverInstantiatedXYZ")).toBeUndefined();
    });

    it("getInstance throws when given an empty string.", () => {
        expect(() => factory.getInstance("")).toThrow("No valid nameOrType was specified.");
    });

    it("destroy() uses the internal _name for cleanup even when the instance has its own business 'name' field.", async () => {
        class NamedEntity {
            public name = "Acme Corp";
        }
        const localFactory = new ObjectFactory(config, Logger());
        localFactory.register(NamedEntity);
        const instance: any = await localFactory.newInstance(NamedEntity, { name: "primary" });
        expect(instance._name).toBe("NamedEntity:primary");

        await localFactory.destroy(instance);

        // Must be removed under its real registry key, not under its business "name" value.
        expect(localFactory.instances.has("NamedEntity:primary")).toBe(false);
        expect(localFactory.instances.has("Acme Corp")).toBe(false);
        localFactory.clear();
    });

    it("newInstance does not skip the namespace prefix just because the name contains the class name as a substring.", async () => {
        const instance: any = await factory.newInstance(TestClassA, { name: "TestClassAPrimary" });
        expect(instance._name).toBe("TestClassA:TestClassAPrimary");
    });

    it("getInstance honors a custom .fqn the same way newInstance/register do.", async () => {
        class CustomFqnClass {}
        (CustomFqnClass as any).fqn = "custom.CustomFqnClass";
        const localFactory = new ObjectFactory(config, Logger());
        localFactory.register(CustomFqnClass);
        const instance: any = await localFactory.newInstance(CustomFqnClass, { name: "default" });
        expect(instance).toBeDefined();

        // Before the fix, getInstance ignored `.fqn` and searched for "CustomFqnClass:default" instead of
        // "custom.CustomFqnClass:default", so this would return undefined despite a live instance existing.
        const found: any = localFactory.getInstance(CustomFqnClass);
        expect(found).toBe(instance);
        localFactory.clear();
    });

    it("@Inject's implicit default name reuses an existing instance of the class instead of creating a disconnected duplicate.", async () => {
        class Dependency {
            public marker = Math.random();
        }
        class Consumer {
            @Inject(Dependency)
            public dep?: Dependency;
        }
        const localFactory = new ObjectFactory(config, Logger());
        localFactory.register(Dependency);
        localFactory.register(Consumer);

        // Create the dependency first under a name other than "default" - simulating an app that bootstraps a
        // shared singleton before any class that @Injects it is instantiated.
        const dep: any = await localFactory.newInstance(Dependency, { name: "shared" });

        const consumer: any = await localFactory.newInstance(Consumer, { name: "default" });
        expect(consumer.dep).toBe(dep);
        localFactory.clear();
    });
});
