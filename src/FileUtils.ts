///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import fs from "fs";
import path from "path";
import { StringUtils } from "./StringUtils.js";
import { mkdirp } from "mkdirp";
import { Logger } from "./Logger.js";
const logger = Logger();

/**
 * Utility functions for working with files.
 * @author Jean-Philippe Steinmetz
 */
 export class FileUtils {
    /**
     * Throws an error if `target` is not contained within `rootDir`. Used to prevent path traversal (e.g. `../`)
     * from escaping an intended root when a caller opts in by providing `rootDir`.
     *
     * Both `rootDir` and the longest already-existing ancestor of `target` are resolved via `fs.realpathSync`
     * before the containment check, not just `path.resolve`. Without this, a symlink placed anywhere on disk
     * within `target`'s existing ancestry (including `target` itself) that points outside `rootDir` would pass
     * a purely lexical check, yet `fs.existsSync`/`fs.writeFileSync`/`fs.readFileSync` etc. would transparently
     * follow it - defeating the containment guarantee entirely. Any remaining (not-yet-existing) trailing path
     * segments can't be symlinks yet, so they're safely appended as literal strings.
     *
     * @param {string} rootDir The directory that `target` must be contained within. Must exist.
     * @param {string} target The path to verify.
     * @returns The fully resolved (existing-portion realpath'd) path. Callers should use this value - not the
     * original `target` - for the actual filesystem operation, so a symlink swapped in after this check can't
     * reintroduce the gap it closes.
     */
    public static assertContained(rootDir: string, target: string): string {
        const rootReal = fs.realpathSync(path.resolve(rootDir));

        let existingPart = path.resolve(target);
        const remainder: string[] = [];
        while (!fs.existsSync(existingPart)) {
            const parent = path.dirname(existingPart);
            // `path.dirname()` of a filesystem root returns that same root, which is the only way this loop
            // could otherwise become infinite. Not practically reachable in a real filesystem (the root itself
            // always exists), so this is defense-in-depth rather than an expected/tested case.
            /* v8 ignore next */
            if (parent === existingPart) break;
            remainder.unshift(path.basename(existingPart));
            existingPart = parent;
        }
        const existingReal = fs.realpathSync(existingPart);
        const targetReal = remainder.length > 0 ? path.join(existingReal, ...remainder) : existingReal;

        const rel = path.relative(rootReal, targetReal);
        if (rel !== "" && (rel.startsWith("..") || path.isAbsolute(rel))) {
            throw new Error(`Path "${target}" escapes the allowed root directory "${rootReal}".`);
        }
        return targetReal;
    }

    /**
     * Attempts to write the provided contents to the file path given. If a file already exists at the destination
     * an error is thrown unless `overwrite` is set to `true`.
     *
     * @param {string} srcPath The baseline template file the contents were generated from.
     * @param {string} outPath The destination file path to be written.
     * @param {any} contents The contents of the file to write.
     * @param {boolean} overwrite Set to `true` to overwrite an existing file at `outPath`.
     * @param {string} rootDir Optional. When provided, `srcPath` and `outPath` must both resolve to a location
     * contained within this directory, otherwise an error is thrown. Callers that pass externally-influenced paths
     * should always supply this to prevent path traversal.
     */
    public static async writeFile(
        srcPath: string,
        outPath: string,
        contents: any,
        overwrite: boolean = false,
        rootDir?: string
    ): Promise<void> {
        let srcPathFull = path.resolve(srcPath);
        let outPathFull = path.resolve(outPath);

        if (rootDir) {
            FileUtils.assertContained(rootDir, srcPathFull);
            outPathFull = FileUtils.assertContained(rootDir, outPathFull);
        }

        // Make sure the path leading to the final destination exists
        let outDirPath = path.dirname(outPathFull);
        if (!fs.existsSync(outDirPath)) {
            await mkdirp(outDirPath);
        }

        // Write the final output to disk. When `overwrite` is `false`, the exclusive `"wx"` flag makes the
        // existence check and the write atomic - `fs.existsSync()` followed by a plain write would otherwise
        // leave a window where two concurrent calls both see no existing file and one silently clobbers the
        // other's output.
        logger.info("Writing: " + outPathFull);
        try {
            fs.writeFileSync(outPathFull, contents, overwrite ? undefined : { flag: "wx" });
        } catch (err: any) {
            if (!overwrite && err?.code === "EEXIST") {
                throw new Error(`File already exists at "${outPathFull}". Pass overwrite=true to replace it.`);
            }
            throw err;
        }
    }

    /**
     * Generates a copy of the source file at the desired output destination and performs a swap of all values of the
     * variables specified.
     *
     * @param {string} srcPath The source file to copy.
     * @param {string} outPath The destination file to generate.
     * @param {any} variables The map of variable names to values to swap.
     * @param {boolean} overwrite Set to `true` to overwrite an existing file at `outPath`.
     * @param {string} rootDir Optional. When provided, all resolved source and destination paths must be contained
     * within this directory, otherwise an error is thrown.
     */
    public static async copyFile(
        srcPath: string,
        outPath: string,
        variables: any = {},
        overwrite: boolean = false,
        rootDir?: string
    ): Promise<void> {
        let srcPathFull: string = path.resolve(srcPath);

        // Containment is checked *before* existence: assertContained() already tolerates a not-yet-existing
        // target (it walks up to the nearest existing ancestor), so checking existence first would let a path
        // outside rootDir get a different error ("File does not exist") depending on whether it happens to
        // exist on disk - a file-existence oracle for paths the caller is supposed to be sandboxed away from.
        if (rootDir) {
            // Re-resolved via the realpath'd return value so the subsequent read follows the *validated* path
            // rather than the original (potentially symlinked) one.
            srcPathFull = FileUtils.assertContained(rootDir, srcPathFull);
        }

        if (!fs.existsSync(srcPathFull)) {
            throw new Error("File does not exist: " + srcPathFull);
        }

        let template = fs.readFileSync(srcPathFull, "utf-8");
        let output = StringUtils.findAndReplace(template, variables);
        let outPathFinal = path.resolve(StringUtils.findAndReplace(outPath, variables));
        logger.info("Writing: " + outPathFinal);
        await FileUtils.writeFile(srcPath, outPathFinal, output, overwrite, rootDir);
    }

    /**
     * Generates a copy of the source file at the desired output destination using binary copy mode.
     *
     * @param {string} srcPath The source file to copy.
     * @param {string} outPath The destination file to generate.
     * @param {Map<string,string>} variables The map of variable names to values to swap. Applies to outPath only.
     * @param {string} rootDir Optional. When provided, all resolved source and destination paths must be contained
     * within this directory, otherwise an error is thrown.
     * @param {boolean} overwrite Set to `true` to overwrite an existing file at the destination. Default is `false`,
     * matching the behavior of `writeFile`/`copyFile`. Appended after `rootDir` to preserve the existing positional
     * call signature - note this is the opposite order from `copyFile`'s `(overwrite, rootDir)`.
     */
    public static async copyBinaryFile(
        srcPath: string,
        outPath: string,
        variables: any = {},
        rootDir?: string,
        overwrite: boolean = false
    ): Promise<void> {
        // `copyBinaryFile`'s `(rootDir, overwrite)` parameter order is the reverse of `copyFile`'s
        // `(overwrite, rootDir)`. A caller that swaps them by analogy with `copyFile` would otherwise either
        // silently disable overwrite protection (a boolean passed where `rootDir` is expected is truthy and
        // simply fails the `typeof` check for a path) or crash confusingly deep inside `path.resolve()`, so it's
        // rejected here with a message that explains the actual mistake.
        if (rootDir !== undefined && typeof rootDir !== "string") {
            throw new TypeError(
                `copyBinaryFile: "rootDir" must be a string, got ${typeof rootDir}. Did you mean to swap the ` +
                    `"overwrite" and "rootDir" arguments? Unlike copyFile, copyBinaryFile's signature is ` +
                    `(srcPath, outPath, variables, rootDir, overwrite).`,
            );
        }
        if (typeof overwrite !== "boolean") {
            throw new TypeError(`copyBinaryFile: "overwrite" must be a boolean, got ${typeof overwrite}.`);
        }

        let srcPathFull: string = path.resolve(srcPath);

        if (!fs.existsSync(srcPathFull)) {
            throw new Error("File does not exist: " + srcPathFull);
        }

        if (rootDir) {
            srcPathFull = FileUtils.assertContained(rootDir, srcPathFull);
        }

        let outPathFinal: string = path.resolve(StringUtils.findAndReplace(outPath, variables));

        if (rootDir) {
            outPathFinal = FileUtils.assertContained(rootDir, outPathFinal);
        }

        // Make sure the path leading to the final (template-substituted) destination exists. Must be derived from
        // `outPathFinal`, not the raw `outPath`, otherwise the created directory can differ from the one actually
        // written to whenever `outPath`'s directory itself contains template variables.
        let outDirPath = path.dirname(outPathFinal);
        if (!fs.existsSync(outDirPath)) {
            await mkdirp(outDirPath);
        }

        // `COPYFILE_EXCL` makes the existence check and the copy atomic when `overwrite` is `false` - a plain
        // `fs.existsSync()` check followed by an unconditional copy would otherwise leave a window where two
        // concurrent calls both see no existing file and one silently clobbers the other's output.
        try {
            fs.copyFileSync(srcPathFull, outPathFinal, overwrite ? 0 : fs.constants.COPYFILE_EXCL);
        } catch (err: any) {
            if (!overwrite && err?.code === "EEXIST") {
                throw new Error(`File already exists at "${outPathFinal}". Pass overwrite=true to replace it.`);
            }
            throw err;
        }
    }

    /**
     * Performs a deep copy of a directory tree at the given srcPath to the specified output directory. Performs
     * template replacement for all variables given and skips any files in the specified filter.
     *
     * @param {string} srcPath The path to the source directory to copy files from.
     * @param {string} outPath The path to the destination directory to copy files to.
     * @param {any} vars The map of template variables to perform replacement on.
     * @param {array} excludeFilters The list of file extension filters to exclude during the copy process.
     * @param {array} binaryFilters The list of file extension filters to copy as binary only.
     * @param {boolean} force Set to `true` to force writing over any existing files.
     * @param {string} rootDir Optional. When provided, all resolved source and destination paths must be contained
     * within this directory, otherwise an error is thrown.
     */
    public static async copyDirectory(
        srcPath: string,
        outPath: string,
        vars: any = {},
        excludeFilters: Array<string> = [],
        binaryFilters: Array<string> = [],
        force: boolean = false,
        rootDir?: string
    ): Promise<void> {
        let templatePath = path.resolve(srcPath);

        if (rootDir) {
            templatePath = FileUtils.assertContained(rootDir, templatePath);
        }

        let files = fs.readdirSync(templatePath, { withFileTypes: true });
        // Copied concurrently via `Promise.all` rather than a sequentially-awaited loop, since sibling entries
        // in the same directory are independent of one another. `Promise.all` still `await`s every entry before
        // `copyDirectory` itself resolves and still propagates the first rejection to the caller, so this keeps
        // the same "wait for everything, never swallow an error" guarantee a sequential loop would - it just lets
        // independent copies overlap instead of running strictly one at a time.
        await Promise.all(
            files.map(async (file) => {
                let extension = path.extname(file.name);
                if (!extension) {
                    extension = file.name;
                }
                extension = extension.replace(".", "");
                if (excludeFilters.indexOf(extension) === -1) {
                    let destPath = StringUtils.findAndReplace(path.join(outPath, file.name), vars);

                    if (rootDir) {
                        destPath = FileUtils.assertContained(rootDir, destPath);
                    }

                    if (file.isDirectory()) {
                        if (!fs.existsSync(destPath)) {
                            // Recursive: `outPath` itself may not exist yet either, e.g. when directory entries are
                            // processed ahead of any file entry that would otherwise implicitly create it via mkdirp.
                            fs.mkdirSync(destPath, { recursive: true });
                        }
                        await FileUtils.copyDirectory(
                            path.join(templatePath, file.name),
                            destPath,
                            vars,
                            excludeFilters,
                            binaryFilters,
                            force,
                            rootDir
                        );
                    } else if (binaryFilters.indexOf(extension) >= 0) {
                        await FileUtils.copyBinaryFile(path.join(templatePath, file.name), destPath, vars, rootDir, force);
                    } else {
                        await FileUtils.copyFile(path.join(templatePath, file.name), destPath, vars, force, rootDir);
                    }
                }
            }),
        );
    }
}
