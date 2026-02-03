///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import config from "./config.js";
import { ObjectFactory } from "../src/ObjectFactory.js";
import { Inject, Destroy } from "../src/decorators/ObjectDecorators.js";
import { Logger } from "../src/Logger.js";
import { CircularClassA } from "./factory/CircularClassA.js";
import { CircularClassB } from "./factory/CircularClassB.js";
import { ClassC } from "./factory/ClassC.js";
import { ClassD } from "./factory/ClassD.js";
const uuid = require("uuid");
import { describe, it, expect, beforeEach, afterEach } from "vitest";
class TestClassA {
    @Destroy
    public destroy(): void {
        // no-op
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
            name: uuid.v4(),
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
});
