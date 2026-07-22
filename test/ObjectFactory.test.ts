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
});
