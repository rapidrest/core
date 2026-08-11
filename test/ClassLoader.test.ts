///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import fs from "fs";
import path from "path";
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

        const jsNamedExport: string = `
\`use strict\`;

class MyClassNamed {
    contructor() {
    }
}

module.exports.MyClassNamed = MyClassNamed;
        `;

        await mkdirp("./test/test-classes/com/company/javascript");
        await mkdirp("./test/test-classes/com/company/typescript");
        fs.writeFileSync("./test/test-classes/dummy.txt", "This is a test");
        fs.writeFileSync("./test/test-classes/MyJavaScriptClass.cjs", jsMyClass);
        fs.writeFileSync("./test/test-classes/MyJavaScriptNamedExport.cjs", jsNamedExport);
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
        expect(loader.getClass("MyClassNamed")).toBeDefined();
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

    it("Can check if a class has been loaded.", async () => {
        let loader: ClassLoader = new ClassLoader("./test/test-classes");
        expect(loader).toBeDefined();
        await loader.load();
        expect(loader.hasClass("MyTypeScriptClass")).toBe(true);
        expect(loader.hasClass("com.company.NonExistentClass")).toBe(false);
    });

    it("Fails to load a directory that escapes the root directory.", async () => {
        let loader: ClassLoader = new ClassLoader("./test/test-classes/com/company");
        expect(loader).toBeDefined();
        try {
            await loader.load("../../../../etc");
            throw new Error("Failed to throw error.");
        } catch (err: any) {
            expect(err.message).toContain("escapes the allowed root directory");
        }
    });

    it("Can ignore files matching the ignore list.", async () => {
        let loader: ClassLoader = new ClassLoader("./test/test-classes", true, true, ["dummy.txt"]);
        expect(loader).toBeDefined();
        await loader.load();
        let classes: Map<string, any> = loader.getClasses();
        expect(classes).toBeDefined();
        expect(loader.getClass("MyTypeScriptClass")).toBeDefined();
    });

    it("Fails to load a directory reached via a symlink that escapes the root directory.", async () => {
        // "junction" is used (rather than a plain file/dir symlink) because it's the only symlink type
        // Windows lets an unprivileged process create; the `type` argument is ignored on POSIX, so this
        // still produces an ordinary symlink there.
        const outsideDir: string = path.resolve("./test/test-classes-outside");
        await mkdirp(outsideDir);
        fs.writeFileSync(path.join(outsideDir, "Evil.cjs"), "module.exports.default = class Evil {};");
        const linkPath: string = "./test/test-classes/evil-link";
        fs.symlinkSync(outsideDir, linkPath, "junction");

        try {
            let loader: ClassLoader = new ClassLoader("./test/test-classes");
            try {
                await loader.load();
                throw new Error("Failed to throw error.");
            } catch (err: any) {
                expect(err.message).toContain("escapes the allowed root directory");
            }
        } finally {
            fs.rmSync(linkPath, { recursive: true, force: true });
            rimraf.sync(outsideDir);
        }
    });

    it("Does not throw for a symlink that stays within the root directory.", async () => {
        // Directory symlinks aren't recursed into either way - `fs.Dirent.isDirectory()` reflects the symlink
        // entry itself (always `false`), not its target - so this only exercises the containment check itself:
        // a symlink that resolves inside rootDir must be allowed through rather than rejected.
        const target: string = path.resolve("./test/test-classes/com/company/typescript");
        const linkPath: string = "./test/test-classes/typescript-link";
        fs.symlinkSync(target, linkPath, "junction");

        try {
            let loader: ClassLoader = new ClassLoader("./test/test-classes");
            await expect(loader.load()).resolves.not.toThrow();
        } finally {
            fs.rmSync(linkPath, { recursive: true, force: true });
        }
    });
});
