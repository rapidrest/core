///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import fs from "fs";
import path from "path";
/**
 * The *ClassLoader* provides a container for dynamically loading classes at runtime using C#/Java style namespaces.
 * Namespaces are determined from the folder structure relative to the root.
 *
 * Class names are derived either directly from the modules export name or inferred from the module's file path when
 * the `default` export is used.
 *
 * For example, given the following example TypeScript module at relative path `com/company/MyClass.ts` would register
 * a class with fully qualified name `com.company.MyClass`.
 *
 * ```javascript
 * export default class MyClass {
 *     // ...
 * }
 * ```
 *
 * In the event that multiple exports are defined, the fully qualified name will take on the export name instead of the
 * module name. Thus, the following example module at relative path `com/company/MyClasses.ts` would register the following
 * classes.
 * - `com.company.MyClass`
 * - `com.company.MyEnum`
 *
 * ```javascript
 * export class MyClass {
 *     // ...
 * }
 *
 * export enum MyEnum {
 *     // ...
 * }
 * ```
 * 
 * **IMPORTANT**: If you use *ClassLoader* to dynamically load TypeScript files (.ts, .cts, .mts, etc.) at runtime using
 * an ESM-only project you must use the `ts-node/esm` module loader. This can be specified by passing the `--loader` to
 * node at runtime.
 * 
 * ```
 * node --loader ts-node/esm <module>
 * ```
 *
 * @author Jean-Philippe Steinmetz
 */
export class ClassLoader {
    /** The map containnig all loaded classes. */
    protected classes: Map<string, any> = new Map<string, any>();
    protected ignore: (string | RegExp)[] = [];
    /** Indicates if TypeScript classes should be loaded. */
    protected includeTypeScript: boolean = true;
    /** Indicates if JavaScript classes should be loaded. */
    protected includeJavaScript: boolean = true;
    /** The path to the root directory containing all classes on disk. */
    protected rootDir: string = ".";

    /**
     * Creates a new instance of `ClassLoader` with the specified defaults.
     *
     * @param rootDir The root directory to load all classes from.
     * @param includeJavaScript Set to `true` to load all TypeScript classes from the given `rootDir`, otherwise set to `false.
     * @param includeTypeScript Set to `true` to load all JavaScript classes from the given `rootDir`, otherwise set to `false.
     * @param ignore A list of regex pattern of file paths to ignore.
     */
    constructor(rootDir: string, includeJavaScript: boolean = true, includeTypeScript: boolean = true, ignore: (string | RegExp)[] = []) {
        this.rootDir = path.resolve(rootDir);
        this.includeJavaScript = includeJavaScript;
        this.includeTypeScript = includeTypeScript;
        this.ignore = ignore;
    }

    /**
     * Returns the class with the specified fully qualified name.
     *
     * @param fqn The fully qualified name of the class to return.
     * @returns The class definition for the given fully qualified name if found, otherwise `undefined`.
     */
    public getClass(fqn: string): any | undefined {
        return this.classes.get(fqn);
    }

    /**
     * Returns the map containing all classes that have been loaded.
     */
    public getClasses(): Map<string, any> {
        return this.classes;
    }

    /**
     * Returns `true` if a class exists with the specified fully qualified name.
     *
     * @param fqn The fully qualified name of the class to search.
     * @returns `true` if a class definition exists for the given fully qualified name, otherwise `false`.
     */
    public hasClass(fqn: string): any | undefined {
        return this.classes.get(fqn) ? true : false;
    }

    /**
     * Loads all modules exports contained in the directory specified. The folder must be a child
     * directory to the `rootDir` parameter passed in to the constructor.
     *
     * @param dir The directory, relative to `rootDir`, containing modules to load.
     */
    public async load(dir: string = ""): Promise<void> {
        let fqp: string = path.resolve(path.join(this.rootDir, dir));
        let files: fs.Dirent[] = fs.readdirSync(fqp, { withFileTypes: true });
        for (let file of files) {
            // Is the file in the ignore list?
            let skipFile: boolean = false;
            for (const iPath of this.ignore) {
                if (file.name.match(iPath)) {
                    skipFile = true;
                    break;
                }
            }
            if (skipFile) {
                continue;
            }

            let extension = path.extname(file.name);
            if (!extension) {
                extension = file.name;
            }

            let relpath: string = path.relative(this.rootDir, fqp);
            let fullpath: string = path.resolve(path.join(this.rootDir, relpath, file.name));
            let pkg: string = relpath.replace(new RegExp("\\" + path.sep, "g"), ".");

            if (file.isDirectory()) {
                let subdir: string = path.join(dir, file.name);
                await this.load(subdir);
            } else if (this.includeJavaScript && extension.match(/^\.(js|cjs|mjs)$/)) {
                const mod: any = await import(fullpath);
                if (mod) {
                    for (let name in mod) {
                        let clazz: any = mod[name];
                        let fqn: string = `${pkg.length > 0 ? pkg + "." : ""}${name === "default" ? file.name.split(".")[0] : name}`;
                        clazz.fqn = fqn;
                        this.classes.set(fqn, clazz);
                    }
                } else {
                    throw new Error("Failed to load module file: " + fullpath);
                }
            } else if (this.includeTypeScript && extension.match(/^\.(ts|cts|mts|tsx)$/)) {
                const mod: any = await import(fullpath);
                if (mod) {
                    for (let name in mod) {
                        let clazz: any = mod[name];
                        let fqn: string = `${pkg.length > 0 ? pkg + "." : ""}${name === "default" ? file.name.split(".")[0] : name}`;
                        clazz.fqn = fqn;
                        this.classes.set(fqn, clazz);
                    }
                } else {
                    throw new Error("Failed to load module file: " + fullpath);
                }
            }
        }
    }
}
