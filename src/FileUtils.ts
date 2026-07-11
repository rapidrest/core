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
     * Throws an error if the resolved `target` path is not contained within the resolved `rootDir` directory. Used
     * to prevent path traversal (e.g. `../`) from escaping an intended root when a caller opts in by providing
     * `rootDir`.
     *
     * @param {string} rootDir The directory that `target` must be contained within.
     * @param {string} target The fully resolved path to verify.
     */
    private static assertContained(rootDir: string, target: string): void {
        const rootResolved = path.resolve(rootDir);
        const targetResolved = path.resolve(target);
        const rel = path.relative(rootResolved, targetResolved);
        if (rel !== "" && (rel.startsWith("..") || path.isAbsolute(rel))) {
            throw new Error(`Path "${target}" escapes the allowed root directory "${rootResolved}".`);
        }
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
            FileUtils.assertContained(rootDir, outPathFull);
        }

        let fileExists = fs.existsSync(outPathFull);

        // Make sure the path leading to the final destination exists
        let outDirPath = path.dirname(outPath);
        if (!fs.existsSync(outDirPath)) {
            await mkdirp(outDirPath);
        }

        if (fileExists && !overwrite) {
            throw new Error(
                `File already exists at "${outPathFull}". Pass overwrite=true to replace it.`
            );
        }

        // Write the final output to disk
        logger.info("Writing: " + outPathFull);
        fs.writeFileSync(outPathFull, contents);
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
        let srcPathFull: any = path.resolve(srcPath);

        if (rootDir) {
            FileUtils.assertContained(rootDir, srcPathFull);
        }

        if (!fs.existsSync(srcPathFull)) {
            throw new Error("File does not exist: " + srcPathFull);
        }

        // Make sure the path leading to the final destination exists
        let outDirPath = path.dirname(outPath);
        if (!fs.existsSync(outDirPath)) {
            await mkdirp(outDirPath);
        }

        let template = fs.readFileSync(srcPathFull, "utf-8");
        if (template) {
            let output = StringUtils.findAndReplace(template, variables);
            let outPathFinal = path.resolve(StringUtils.findAndReplace(outPath, variables));
            logger.info("Writing: " + outPathFinal);
            await FileUtils.writeFile(srcPath, outPathFinal, output, overwrite, rootDir);
        } else {
            throw new Error("Failed to read file: " + srcPathFull);
        }
    }

    /**
     * Generates a copy of the source file at the desired output destination using binary copy mode.
     *
     * @param {string} srcPath The source file to copy.
     * @param {string} outPath The destination file to generate.
     * @param {Map<string,string>} variables The map of variable names to values to swap. Applies to outPath only.
     * @param {string} rootDir Optional. When provided, all resolved source and destination paths must be contained
     * within this directory, otherwise an error is thrown.
     */
    public static async copyBinaryFile(srcPath: string, outPath: string, variables: any = {}, rootDir?: string): Promise<void> {
        let srcPathFull: any = path.resolve(srcPath);

        if (rootDir) {
            FileUtils.assertContained(rootDir, srcPathFull);
        }

        if (!fs.existsSync(srcPathFull)) {
            throw new Error("File does not exist: " + srcPathFull);
        }

        // Make sure the path leading to the final destination exists
        let outDirPath = path.resolve(path.dirname(outPath));
        if (!fs.existsSync(outDirPath)) {
            await mkdirp(outDirPath);
        }

        let outPathFinal: string = path.resolve(StringUtils.findAndReplace(outPath, variables));

        if (rootDir) {
            FileUtils.assertContained(rootDir, outPathFinal);
        }

        fs.copyFileSync(srcPathFull, outPathFinal);
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
        const templatePath = path.resolve(srcPath);

        if (rootDir) {
            FileUtils.assertContained(rootDir, templatePath);
        }

        let files = fs.readdirSync(templatePath, { withFileTypes: true });
        files.forEach(async (file: any) => {
            let extension = path.extname(file.name);
            if (!extension) {
                extension = file.name;
            }
            extension = extension.replace(".", "");
            if (excludeFilters.indexOf(extension) === -1) {
                let destPath = StringUtils.findAndReplace(path.join(outPath, file.name), vars);

                if (file.isDirectory()) {
                    if (!fs.existsSync(destPath)) {
                        fs.mkdirSync(destPath);
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
                    await FileUtils.copyBinaryFile(path.join(templatePath, file.name), destPath, vars, rootDir);
                } else {
                    await FileUtils.copyFile(path.join(templatePath, file.name), destPath, vars, force, rootDir);
                }
            }
        });
    }
}
