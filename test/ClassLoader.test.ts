///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import fs from "fs";
import { ClassLoader } from "../src/ClassLoader.js";
import * as rimraf from "rimraf";
import { mkdirp } from "mkdirp";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("ClassLoader Tests", () => {
    beforeAll(async () => {
        const jsMyClass: string = `
\`use strict\`;

class MyClass {
    contructor() {
    }
}

module.exports.default = MyClass;
        `;

        const tsMyClass: string = `
export default class MyClass {
    contructor() {
    }
}

export enum MyEnum {
    VALUE1,
    VALUE2,
    VALUE3
}
        `;

        const tsMultipleExports: string = `
export class MyClass2 {
    contructor() {
    }
}

export enum MyEnum2 {
    VALUE1,
    VALUE2,
    VALUE3
}
        `;

        await mkdirp("./test/test-classes/com/company/javascript");
        await mkdirp("./test/test-classes/com/company/typescript");
        fs.writeFileSync("./test/test-classes/dummy.txt", "This is a test");
        fs.writeFileSync("./test/test-classes/MyJavaScriptClass.cjs", jsMyClass);
        fs.writeFileSync("./test/test-classes/com/company/javascript/MyClass.cjs", jsMyClass);
        fs.writeFileSync("./test/test-classes/com/company/dummy.txt", "This is a test");
        fs.writeFileSync("./test/test-classes/MyTypeScriptClass.ts", tsMyClass);
        fs.writeFileSync("./test/test-classes/com/company/typescript/MyClass.ts", tsMyClass);
        fs.writeFileSync("./test/test-classes/com/company/typescript/MultipleExports.ts", tsMultipleExports);
        fs.writeFileSync("./test/test-classes/com/company/typescript/dummy.txt", "This is a test");
    });

    afterAll(() => {
        rimraf.sync("./test/test-classes");
    });

    it("Can load classes.", async () => {
        let loader: ClassLoader = new ClassLoader("./test/test-classes");
        expect(loader).toBeDefined();
        await loader.load();
        let classes: Map<string, any> = loader.getClasses();
        expect(classes).toBeDefined();
        expect(loader.getClass("MyJavaScriptClass")).toBeDefined();
        expect(loader.getClass("com.company.javascript.MyClass")).toBeDefined();
        expect(loader.getClass("MyTypeScriptClass")).toBeDefined();
        expect(loader.getClass("com.company.typescript.MyClass")).toBeDefined();
        expect(loader.getClass("com.company.typescript.MyEnum")).toBeDefined();
        expect(loader.getClass("com.company.typescript.MyClass2")).toBeDefined();
        expect(loader.getClass("com.company.typescript.MyEnum2")).toBeDefined();
    });

    it("Can load JavaScript classes only.", async () => {
        let loader: ClassLoader = new ClassLoader("./test/test-classes", true, false);
        expect(loader).toBeDefined();
        await loader.load();
        let classes: Map<string, any> = loader.getClasses();
        expect(classes).toBeDefined();
        expect(loader.getClass("MyJavaScriptClass")).toBeDefined();
        expect(loader.getClass("com.company.javascript.MyClass")).toBeDefined();
    });

    it("Can load TypeScript classes only.", async () => {
        let loader: ClassLoader = new ClassLoader("./test/test-classes", false, true);
        expect(loader).toBeDefined();
        await loader.load();
        let classes: Map<string, any> = loader.getClasses();
        expect(classes).toBeDefined();
        expect(loader.getClass("MyTypeScriptClass")).toBeDefined();
        expect(loader.getClass("com.company.typescript.MyClass")).toBeDefined();
        expect(loader.getClass("com.company.typescript.MyEnum")).toBeDefined();
        expect(loader.getClass("com.company.typescript.MyClass2")).toBeDefined();
        expect(loader.getClass("com.company.typescript.MyEnum2")).toBeDefined();
    });

    it("Can load from sub-directory only.", async () => {
        let loader: ClassLoader = new ClassLoader("./test/test-classes");
        expect(loader).toBeDefined();
        await loader.load("com");
        let classes: Map<string, any> = loader.getClasses();
        expect(classes).toBeDefined();
        expect(loader.getClass("com.company.javascript.MyClass")).toBeDefined();
        expect(loader.getClass("com.company.typescript.MyClass")).toBeDefined();
        expect(loader.getClass("com.company.typescript.MyEnum")).toBeDefined();
        expect(loader.getClass("com.company.typescript.MyClass2")).toBeDefined();
        expect(loader.getClass("com.company.typescript.MyEnum2")).toBeDefined();
    });
});
