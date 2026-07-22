///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import * as fs from "fs";
import * as path from "path";
import { FileUtils } from "../src/FileUtils.js";
import * as rimraf from "rimraf";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
describe("FileUtils Tests", () => {
    beforeAll(() => {
        fs.mkdirSync("tests-fileutils");
    });

    afterAll(() => {
        rimraf.sync("tests-fileutils");
        rimraf.sync("tests-fileutils.copy");
        rimraf.sync("tests-fileutils.copy2");
        rimraf.sync("tests-fileutils-root");
        rimraf.sync("tests-fileutils-copydir-src");
        rimraf.sync("tests-fileutils-copydir-dest");
    });

    it("writeFile succeeds.", async () => {
        fs.writeFileSync("tests-fileutils/test.txt", "This is a test.");
        expect(fs.existsSync("tests-fileutils/test.txt")).toBe(true);
        await FileUtils.writeFile("tests-fileutils/test.txt", "tests-fileutils/test.out.txt", "This is a test.");
        expect(fs.existsSync("tests-fileutils/test.out.txt")).toBe(true);
        let content = fs.readFileSync("tests-fileutils/test.out.txt", "utf8");
        expect(content).toBe("This is a test.");
    });

    it("writeFile creates the destination directory when it does not exist.", async () => {
        rimraf.sync("tests-fileutils/newdir");
        expect(fs.existsSync("tests-fileutils/newdir")).toBe(false);
        await FileUtils.writeFile(
            "tests-fileutils/test.txt",
            "tests-fileutils/newdir/nested/test.out.txt",
            "This is a test."
        );
        expect(fs.existsSync("tests-fileutils/newdir/nested/test.out.txt")).toBe(true);
    });

    it("writeFile throws when the destination already exists and overwrite is not set.", async () => {
        await FileUtils.writeFile("tests-fileutils/test.txt", "tests-fileutils/test.exists.txt", "Original.");
        expect(fs.existsSync("tests-fileutils/test.exists.txt")).toBe(true);
        try {
            await FileUtils.writeFile("tests-fileutils/test.txt", "tests-fileutils/test.exists.txt", "New.");
            throw new Error("Failed to throw error.");
        } catch (err: any) {
            expect(err.message).toContain("already exists");
        }
        // Overwrite succeeds when explicitly requested.
        await FileUtils.writeFile("tests-fileutils/test.txt", "tests-fileutils/test.exists.txt", "New.", true);
        expect(fs.readFileSync("tests-fileutils/test.exists.txt", "utf8")).toBe("New.");
    });

    it("writeFile succeeds when rootDir contains both paths.", async () => {
        const rootDir = path.resolve("tests-fileutils");
        await FileUtils.writeFile(
            "tests-fileutils/test.txt",
            "tests-fileutils/test.rooted.txt",
            "Rooted contents.",
            true,
            rootDir
        );
        expect(fs.existsSync("tests-fileutils/test.rooted.txt")).toBe(true);
    });

    it("writeFile throws when a path escapes rootDir.", async () => {
        const rootDir = path.resolve("tests-fileutils-root");
        fs.mkdirSync(rootDir, { recursive: true });
        try {
            await FileUtils.writeFile(
                "tests-fileutils/test.txt",
                "tests-fileutils/test.escape.txt",
                "Contents.",
                true,
                rootDir
            );
            throw new Error("Failed to throw error.");
        } catch (err: any) {
            expect(err.message).toContain("escapes the allowed root directory");
        }
    });

    it("copyFile succeeds.", async () => {
        fs.writeFileSync("tests-fileutils/test.txt", "This is a test.");
        expect(fs.existsSync("tests-fileutils/test.txt")).toBe(true);
        await FileUtils.copyFile("tests-fileutils/test.txt", "tests-fileutils/test.copy.txt");
        let content = fs.readFileSync("tests-fileutils/test.copy.txt", "utf8");
        expect(content).toBe("This is a test.");
    });

    it("copyFile throws when the source file does not exist.", async () => {
        try {
            await FileUtils.copyFile("tests-fileutils/does-not-exist.txt", "tests-fileutils/test.copy2.txt");
            throw new Error("Failed to throw error.");
        } catch (err: any) {
            expect(err.message).toContain("File does not exist");
        }
    });

    it("copyFile creates the destination directory when it does not exist.", async () => {
        fs.writeFileSync("tests-fileutils/test.txt", "This is a test.");
        rimraf.sync("tests-fileutils/copydir");
        expect(fs.existsSync("tests-fileutils/copydir")).toBe(false);
        await FileUtils.copyFile("tests-fileutils/test.txt", "tests-fileutils/copydir/nested/test.copy.txt");
        expect(fs.existsSync("tests-fileutils/copydir/nested/test.copy.txt")).toBe(true);
    });

    it("copyFile throws when a path escapes rootDir.", async () => {
        const rootDir = path.resolve("tests-fileutils-root");
        fs.mkdirSync(rootDir, { recursive: true });
        fs.writeFileSync("tests-fileutils/test.txt", "This is a test.");
        try {
            await FileUtils.copyFile("tests-fileutils/test.txt", "tests-fileutils/test.copy3.txt", {}, false, rootDir);
            throw new Error("Failed to throw error.");
        } catch (err: any) {
            expect(err.message).toContain("escapes the allowed root directory");
        }
    });

    it("copyFile throws when the source file is empty.", async () => {
        fs.writeFileSync("tests-fileutils/empty.txt", "");
        try {
            await FileUtils.copyFile("tests-fileutils/empty.txt", "tests-fileutils/empty.copy.txt");
            throw new Error("Failed to throw error.");
        } catch (err: any) {
            expect(err.message).toContain("Failed to read file");
        }
    });

    it("copyBinaryFile succeeds.", async () => {
        fs.writeFileSync("tests-fileutils/test.txt", "This is a test.");
        expect(fs.existsSync("tests-fileutils/test.txt")).toBe(true);
        await FileUtils.copyBinaryFile("tests-fileutils/test.txt", "tests-fileutils/test.copy.txt");
        let content = fs.readFileSync("tests-fileutils/test.copy.txt", "utf8");
        expect(content).toBe("This is a test.");
    });

    it("copyBinaryFile throws when the source file does not exist.", async () => {
        try {
            await FileUtils.copyBinaryFile("tests-fileutils/does-not-exist.txt", "tests-fileutils/test.copy4.txt");
            throw new Error("Failed to throw error.");
        } catch (err: any) {
            expect(err.message).toContain("File does not exist");
        }
    });

    it("copyBinaryFile creates the destination directory when it does not exist.", async () => {
        fs.writeFileSync("tests-fileutils/test.txt", "This is a test.");
        rimraf.sync("tests-fileutils/bincopydir");
        expect(fs.existsSync("tests-fileutils/bincopydir")).toBe(false);
        await FileUtils.copyBinaryFile("tests-fileutils/test.txt", "tests-fileutils/bincopydir/nested/test.copy.txt");
        expect(fs.existsSync("tests-fileutils/bincopydir/nested/test.copy.txt")).toBe(true);
    });

    it("copyBinaryFile throws when the destination path escapes rootDir.", async () => {
        const rootDir = path.resolve("tests-fileutils-root");
        fs.mkdirSync(rootDir, { recursive: true });
        fs.writeFileSync(path.join(rootDir, "test.txt"), "This is a test.");
        try {
            await FileUtils.copyBinaryFile(
                path.join(rootDir, "test.txt"),
                "tests-fileutils/test.copy5.txt",
                {},
                rootDir
            );
            throw new Error("Failed to throw error.");
        } catch (err: any) {
            expect(err.message).toContain("escapes the allowed root directory");
        }
    });

    it("copyDirectory succeeds.", async () => {
        // Use a dedicated, isolated source/destination pair so that leftover files created by other tests in
        // "tests-fileutils" don't get swept up into the copy.
        rimraf.sync("tests-fileutils-copydir-src");
        rimraf.sync("tests-fileutils-copydir-dest");
        fs.mkdirSync("tests-fileutils-copydir-src", { recursive: true });
        fs.writeFileSync("tests-fileutils-copydir-src/test.txt", "This is a test.");
        fs.writeFileSync("tests-fileutils-copydir-src/test.bin", "This is a test binary.");
        fs.writeFileSync("tests-fileutils-copydir-src/test.bak", "This is a test backup.");
        fs.mkdirSync("tests-fileutils-copydir-src/subdir", { recursive: true });
        fs.writeFileSync("tests-fileutils-copydir-src/subdir/nested.txt", "This is a nested test.");
        expect(fs.existsSync("tests-fileutils-copydir-src")).toBe(true);
        expect(fs.existsSync("tests-fileutils-copydir-src/test.txt")).toBe(true);

        // Copy the directory
        await FileUtils.copyDirectory("tests-fileutils-copydir-src", "tests-fileutils-copydir-dest", {}, ["bak"], ["bin"]);

        // Verify the operation succeeded
        expect(fs.existsSync("tests-fileutils-copydir-dest")).toBe(true);
        expect(fs.existsSync("tests-fileutils-copydir-dest/test.txt")).toBe(true);
        expect(fs.existsSync("tests-fileutils-copydir-dest/test.bin")).toBe(true);
        expect(fs.existsSync("tests-fileutils-copydir-dest/test.bak")).toBe(false);
        expect(fs.existsSync("tests-fileutils-copydir-dest/subdir")).toBe(true);
        expect(fs.existsSync("tests-fileutils-copydir-dest/subdir/nested.txt")).toBe(true);

        // Running again against a destination that already exists should not recreate the directory
        // but should still succeed (exercises the `fs.existsSync(destPath)` true branch for the subdir).
        await FileUtils.copyDirectory(
            "tests-fileutils-copydir-src",
            "tests-fileutils-copydir-dest",
            {},
            ["bak"],
            ["bin"],
            true
        );
        expect(fs.existsSync("tests-fileutils-copydir-dest/test.txt")).toBe(true);
    });

    it("copyDirectory throws when the source path escapes rootDir.", async () => {
        const rootDir = path.resolve("tests-fileutils-root");
        fs.mkdirSync(rootDir, { recursive: true });
        try {
            await FileUtils.copyDirectory("tests-fileutils", "tests-fileutils.copy2", {}, [], [], false, rootDir);
            throw new Error("Failed to throw error.");
        } catch (err: any) {
            expect(err.message).toContain("escapes the allowed root directory");
        }
    });

    it("copyDirectory throws when a templated destination path escapes rootDir.", async () => {
        const rootDir = path.resolve("tests-fileutils-root");
        const srcDir = path.join(rootDir, "escape-src");
        fs.mkdirSync(srcDir, { recursive: true });
        // The file name itself contains a template token whose substituted value walks the resolved
        // destination path back outside of rootDir, even though the top-level outPath is contained within it.
        fs.writeFileSync(path.join(srcDir, "{{esc}}.txt"), "This is a test.");

        try {
            await FileUtils.copyDirectory(
                srcDir,
                path.join(rootDir, "escape-dest"),
                { esc: "../../outside-root" },
                [],
                [],
                false,
                rootDir
            );
            throw new Error("Failed to throw error.");
        } catch (err: any) {
            expect(err.message).toContain("escapes the allowed root directory");
        }
    });
});
