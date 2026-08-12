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
        // Only keys with a defined, non-null value are substituted - a missing/undefined/null value leaves the
        // literal "{{key}}" placeholder in the output rather than replacing it with e.g. the string "undefined".
        const keys: string[] = Object.keys(variables).filter((k) => variables[k] !== undefined && variables[k] !== null);
        if (keys.length === 0) {
            return contents;
        }

        // A single combined regex - built once, O(k) - matching any `{{key}}` for any known key, rather than one
        // regex per key checked in a nested O(k²) loop. Each key is escaped since it may contain regex
        // metacharacters (e.g. from external input), which could otherwise be used for regex injection or
        // catastrophic backtracking (ReDoS). Delimiting each alternative with the literal `{{`/`}}` means the
        // matched key text is always recovered exactly, regardless of alternative order or shared prefixes
        // between keys (backtracking still finds the alternative that makes the overall `\{\{...\}\}` match).
        const combined = new RegExp("\\{\\{(" + keys.map((k) => StringUtils.escapeRegExp(k)).join("|") + ")\\}\\}", "g");

        // A function replacer is used (rather than passing the value directly) so a value containing
        // `$`-sequences (`$&`, `$$`, `$1`, ...) is inserted literally instead of being interpreted by
        // `String.replace` as a special pattern.
        const resolve = (key: string): string => (variables[key]).toString();

        // Resolve one level of nested variable references within each value (e.g. a value of "{{adjective}} Dog"
        // has "{{adjective}}" substituted), then use the resolved values for the final pass over `contents`.
        const resolved = new Map<string, string>();
        for (const key of keys) {
            let value: string = resolve(key);
            if (value.includes("{{")) {
                value = value.replace(combined, (_full, matchedKey) => resolve(matchedKey));
            }
            resolved.set(key, value);
        }

        return contents.replace(combined, (_full, matchedKey) => resolved.get(matchedKey) ?? _full);
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
