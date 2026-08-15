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

        const tsPrimitiveExport: string = `
export default class MyClassWithPrimitive {
    contructor() {
    }
}

export const VERSION = "1.0.0";
        `;

        const tsMultiDotFileName: string = `
export default class MultiDotDefault {
    contructor() {
    }
}
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
        fs.writeFileSync("./test/test-classes/com/company/typescript/PrimitiveExport.ts", tsPrimitiveExport);
        fs.writeFileSync("./test/test-classes/com/company/typescript/dummy.txt", "This is a test");
        fs.writeFileSync("./test/test-classes/com/company/typescript/MultiDot.entity.ts", tsMultiDotFileName);
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

    it("Can load a directory containing a module that exports a primitive value alongside a class.", async () => {
        // Regression test: `export const VERSION = "1.0.0"` alongside a class export must not crash the whole
        // directory load - ES modules run in strict mode, and assigning `.fqn` to a primitive-valued export
        // throws a TypeError if it isn't skipped.
        let loader: ClassLoader = new ClassLoader("./test/test-classes");
        expect(loader).toBeDefined();
        await expect(loader.load()).resolves.not.toThrow();
        expect(loader.getClass("com.company.typescript.PrimitiveExport")).toBeDefined();
        expect(loader.getClass("com.company.typescript.VERSION")).toBeUndefined();
        // Sibling classes in the same directory must still load successfully.
        expect(loader.getClass("com.company.typescript.MyClass")).toBeDefined();
    });

    it("Registers a default export's fqn using only the file extension, not the first dot in a multi-dot filename.", async () => {
        // Regression test: `fileName.split(".")[0]` would truncate "MultiDot.entity.ts" at the first dot,
        // registering the default export as "MultiDot" instead of "MultiDot.entity".
        let loader: ClassLoader = new ClassLoader("./test/test-classes");
        await loader.load();
        expect(loader.getClass("com.company.typescript.MultiDot.entity")).toBeDefined();
        expect(loader.getClass("com.company.typescript.MultiDot")).toBeUndefined();
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

    it("Loads a directory outside rootDir when explicitly requested via `dir`, since `dir` is developer-supplied and is not containment-checked.", async () => {
        // See the comment in ClassLoader.load(): `dir` is always supplied by application startup code, never a
        // client request, so there's no threat model where rejecting a `dir` that resolves outside rootDir
        // protects anything - the containment check that used to reject this was intentionally removed.
        const rootDir: string = path.resolve("./test/test-classes/com/company");
        const outsideDir: string = path.resolve("./test/test-classes-outside-dir");
        await mkdirp(outsideDir);
        fs.writeFileSync(path.join(outsideDir, "Outsider.cjs"), "module.exports.default = class Outsider {};");

        try {
            let loader: ClassLoader = new ClassLoader(rootDir);
            await loader.load(path.relative(rootDir, outsideDir));
            const loaded = Array.from(loader.getClasses().keys()).some((fqn) => fqn.endsWith("Outsider"));
            expect(loaded).toBe(true);
        } finally {
            rimraf.sync(outsideDir);
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

    it("Does not throw when a directory contains a symlink pointing outside rootDir, regardless of where it points.", async () => {
        // "junction" is used (rather than a plain file/dir symlink) because it's the only symlink type
        // Windows lets an unprivileged process create; the `type` argument is ignored on POSIX, so this
        // still produces an ordinary symlink there. `fs.Dirent.isDirectory()` reflects the symlink entry
        // itself (always `false`), not its target, so the entry falls through every branch in load() (not
        // recursed into, no matching file extension) regardless of where it points - this was already true
        // before containment was removed, so this documents that the symlink's target no longer matters, not
        // that it's newly being tolerated.
        const outsideDir: string = path.resolve("./test/test-classes-outside");
        await mkdirp(outsideDir);
        fs.writeFileSync(path.join(outsideDir, "Evil.cjs"), "module.exports.default = class Evil {};");
        const linkPath: string = "./test/test-classes/evil-link";
        fs.symlinkSync(outsideDir, linkPath, "junction");

        try {
            let loader: ClassLoader = new ClassLoader("./test/test-classes");
            await expect(loader.load()).resolves.not.toThrow();
            expect(loader.hasClass("Evil")).toBe(false);
        } finally {
            fs.rmSync(linkPath, { recursive: true, force: true });
            rimraf.sync(outsideDir);
        }
    });
});
