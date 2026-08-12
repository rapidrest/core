///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////

/**
 * Utility functions for working with strings.
 *
 * @author Jean-Philippe Steinmetz
 */
export class StringUtils {
    /**
     * Escapes all regular expression metacharacters in `str` so it can be safely embedded in a `RegExp` pattern
     * and matched as a literal string.
     *
     * @param {string} str The string to escape.
     * @returns {string} The escaped string.
     */
    public static escapeRegExp(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    /**
     * Returns a list of all parameters contained within the string. A parameter is a bracket delimited substring
     * (e.g. /my/{key}/with/{id}).
     *
     * @param {any} str The string to search for parameters.
     * @returns {array} A list of parameters contained in the provided string.
     */
    public static getParameters(str: string): Array<string> {
        let results: Array<string> = new Array();

        for (let i = 0; i < str.length; i++) {
            let start = str.indexOf("{", i);
            if (start !== -1) {
                let end = str.indexOf("}", start);
                if (end !== -1) {
                    results.push(str.substring(start + 1, end));
                    i = end;
                } else {
                    break;
                }
            } else {
                break;
            }
        }

        return results;
    }

    /**
     * Performs a search and replace on the provided contents with the map of variable replacements. The contents
     * must use Mustache formatted tokens such as `{{toreplace}}`.
     *
     * @param {string} contents The stringt to perform the find and replace on.
     * @param {object} variables A map of key=>value pairs to search for and replace.
     */
    public static findAndReplace(contents: string, variables: any): string {
        let output: string = contents;

        // Pre-compile one regex per key (O(n)) rather than creating new RegExp inside nested loops (O(n²)).
        // The key is escaped since it may contain regex metacharacters (e.g. from external input), which could
        // otherwise be used for regex injection or catastrophic backtracking (ReDoS).
        const regexCache = new Map<string, RegExp>();
        for (const key in variables) {
            const escapedKey = StringUtils.escapeRegExp(key);
            regexCache.set(key, new RegExp("(\\{\\{" + escapedKey + "\\}\\})", "g"));
        }

        // Go through all variables and perform replacement
        for (const key in variables) {
            // Perform replacement on the variable value itself. This allows nested variable replacement.
            // Uses a null/undefined check rather than a truthiness check so falsy-but-real values (0, false,
            // "") are still substituted instead of leaving the literal "{{key}}" placeholder in the output.
            if (variables[key] !== undefined && variables[key] !== null) {
                let value: string = variables[key] as string;
                for (const key2 in variables) {
                    if (variables[key2] !== undefined && variables[key2] !== null) {
                        // A function replacer is used (rather than passing the value directly as the second
                        // argument) so a value containing `$`-sequences (`$&`, `$$`, `$1`, ...) is inserted
                        // literally instead of being interpreted by `String.replace` as a special pattern.
                        const replacement2 = variables[key2] as string;
                        value = value.toString().replace(regexCache.get(key2)!, () => replacement2);
                    }
                }

                const replacement = value;
                output = output.replace(regexCache.get(key)!, () => replacement);
            }
        }

        return output;
    }

    /**
     * Replaces all instances of the match regex pattern with the contents of the inner regular expression pattern for
     * the given string.
     *
     * @example
     * ```ts
     * let result = replaceAll('/my/path/{id}', new RegExp('\\{([^\\}]+)\\}'), ':');
     * console.log(result); // -> /my/path/:id
     * ```
     * @param {string} str The string to perform replacement on.
     * @param {RegExp} match The regular expression pattern to match containing an outer and inner pattern.
     * @param {string} prefix The prefix to prepend the replacement text with.
     * @returns {string} The fully replaced contents of the string.
     */
    public static replaceAll(str: string, match: string | RegExp, prefix: string): string {
        // Build a single global regex and replace in one O(n) pass instead of looping with repeated .match()
        const global =
            typeof match === "string"
                ? new RegExp(match, "g")
                : match.global
                  ? match
                  : new RegExp(match.source, match.flags + "g");
        return str.replace(global, (_full, capture) => prefix + capture);
    }

    /**
     * Converts the first character in the given string to be lowercase (e.g. myVariable).
     *
     * @param {string} str The string to convert to camelCase.
     * @returns {string} The string converted to camelCase.
     */
    public static toCamelCase(str: string): string {
        return str.charAt(0).toLocaleLowerCase() + str.substring(1);
    }

    /**
     * Converts the first character in the given string to be uppercase (e.g. MyVariable).
     *
     * @param {string} str The string to convert to PascalCase.
     * @returns {string} The string converted to PascalCase.
     */
    public static toPascalCase(str: string): string {
        return str.charAt(0).toLocaleUpperCase() + str.substring(1);
    }
}
