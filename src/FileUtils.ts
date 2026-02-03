///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import child_process from "child_process";
import fs from "fs";
import path from "path";
import { StringUtils } from "./StringUtils.js";
import { mkdirp } from "mkdirp";
import { Logger } from "./Logger.js";

const logger = Logger();
const readline = require("readline");

/**
 * Utility functions for working with files.
 * @author Jean-Philippe Steinmetz
 */
 export class FileUtils {
    /**
     * Attempts to write the provided contents to the file path given. If a file already exists the user is prompted to
     * allow the file to be overwritten or merged. In the case of a merge, srcPath is used as a baseline in order to
     * perform a 3-way merge.
     *
     * @param {string} srcPath The baseline template file to use during a merge.
     * @param {string} outPath The destination file path to be written.
     * @param {any} contents The contents of the file to write.
     * @param {boolean} overwrite Set to `true` to overwite the file and not perform a merge.
     */
    public static async writeFile(
        srcPath: string,
        outPath: string,
        contents: any,
        overwrite: boolean = false
    ): Promise<void> {
        let srcPathFull = path.resolve(srcPath);
        let outPathFull = path.resolve(outPath);
        let fileExists = fs.existsSync(outPathFull);

        // Make sure the path leading to the final destination exists
        let outDirPath = path.dirname(outPath);
        if (!fs.existsSync(outDirPath)) {
            await mkdirp(outDirPath);
        }

        if (fileExists && !overwrite) {
            // Prompt for user action
            let invalidResponse = false;
            while (invalidResponse) {
                let response: string = await new Promise<string>((resolve, reject) => {
                    try {
                        readline(
                            "Overwrite existing file: " + outPath + "? [Y]es, [N]o, [M]erge: ",
                            (answer: string) => {
                                resolve(answer);
                            }
                        );
                    } catch (err) {
                        reject(err);
                    }
                });
                response = response.toLocaleLowerCase();

                if (response.length > 0) {
                    if (response[0] === "y" || response[0] === "n" || response[0] === "m") {
                        if (response[0] === "n") {
                            // Immediately exit, no point in continuing
                            return;
                        }

                        overwrite = response[0] === "y";
                    } else {
                        logger.info("Invalid input: " + response);
                    }
                } else {
                    logger.info("Invalid input: " + response);
                }
            }
        }

        if (!fileExists || overwrite) {
            // Write the final output to disk
            logger.info("Writing: " + outPathFull);
            fs.writeFileSync(outPathFull, contents);
        } else {
            // Attempt to merge the results
            let tmpPath = path.resolve(outPathFull + ".new");
            fs.writeFileSync(tmpPath, contents);
            // Attempt to merge the updated version of the file with the original.
            let mergedPath = path.resolve(outPathFull + ".merged");
            let success = true;
            try {
                let { stdout, stderr } = child_process.exec(
                    "kdiff3 " +
                        srcPathFull +
                        " " +
                        outPathFull +
                        " " +
                        tmpPath +
                        ' -m --auto --cs "ShowInfoDialogs=0" --cs "LineEndStyle=0" -o ' +
                        mergedPath
                );
            } catch (err) {
                success = false;
            }
            // Read back in the newly merged file so we can replace write a new generated date
            let merged = fs.readFileSync(mergedPath, "utf-8");
            merged = merged.replace(new RegExp("^// Last Generated.*$", "g"), "// Last Generated: " + new Date());
            // Write the merged copy to the final destination and clean up temporary files
            logger.info("Writing: " + outPathFull);
            fs.writeFileSync(outPathFull, merged);
            fs.unlinkSync(mergedPath);
            fs.unlinkSync(tmpPath);
        }
    }

    /**
     * Generates a copy of the source file at the desired output destination and performs a swap of all values of the
     * variables specified.
     *
     * @param {string} srcPath The source file to copy.
     * @param {string} outPath The destination file to generate.
     * @param {any} variables The map of variable names to values to swap.
     */
    public static async copyFile(
        srcPath: string,
        outPath: string,
        variables: any = {},
        overwrite: boolean = false
    ): Promise<void> {
        let srcPathFull: any = path.resolve(srcPath);

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
            await FileUtils.writeFile(srcPath, outPathFinal, output, overwrite);
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
     */
    public static async copyBinaryFile(srcPath: string, outPath: string, variables: any = {}): Promise<void> {
        let srcPathFull: any = path.resolve(srcPath);

        if (!fs.existsSync(srcPathFull)) {
            throw new Error("File does not exist: " + srcPathFull);
        }

        // Make sure the path leading to the final destination exists
        let outDirPath = path.resolve(path.dirname(outPath));
        if (!fs.existsSync(outDirPath)) {
            await mkdirp(outDirPath);
        }

        let outPathFinal: string = path.resolve(StringUtils.findAndReplace(outPath, variables));
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
     */
    public static async copyDirectory(
        srcPath: string,
        outPath: string,
        vars: any = {},
        excludeFilters: Array<string> = [],
        binaryFilters: Array<string> = [],
        force: boolean = false
    ): Promise<void> {
        const templatePath = path.resolve(srcPath);
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
                        force
                    );
                } else if (binaryFilters.indexOf(extension) >= 0) {
                    await FileUtils.copyBinaryFile(path.join(templatePath, file.name), destPath, vars);
                } else {
                    await FileUtils.copyFile(path.join(templatePath, file.name), destPath, vars, force);
                }
            }
        });
    }
}