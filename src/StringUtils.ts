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
        const keys: string[] = Object.keys(variables);

        // Keys with a null/undefined value are substituted as an empty string so that "{{key}}" placeholders aren't
        // left in the final string. Resolved into a local copy rather than writing back onto `variables` itself,
        // since this is a read-only formatting call from the caller's perspective - mutating their object would
        // silently overwrite any null/undefined sentinel they relied on after this call returns.
        const values: Record<string, any> = {};
        for (const key of keys) {
            const value = variables[key];
            values[key] = value === null || value === undefined ? "" : value;
        }

        // A single combined regex - built once, O(k) - matching any `{{key}}` for any known key, rather than one
        // regex per key checked in a nested O(k²) loop. Each key is escaped since it may contain regex
        // metacharacters (e.g. from external input), which could otherwise be used for regex injection or
        // catastrophic backtracking (ReDoS). Delimiting each alternative with the literal `{{`/`}}` means the
        // matched key text is always recovered exactly, regardless of alternative order or shared prefixes
        // between keys (backtracking still finds the alternative that makes the overall `\{\{...\}\}` match).
        const combined = new RegExp(
            "\\{\\{(" + keys.map((k) => StringUtils.escapeRegExp(k)).join("|") + ")\\}\\}",
            "g",
        );

        // A function replacer is used (rather than passing the value directly) so a value containing
        // `$`-sequences (`$&`, `$$`, `$1`, ...) is inserted literally instead of being interpreted by
        // `String.replace` as a special pattern.
        const resolve = (key: string): string => values[key].toString();

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

        // Whether `global` has at least one capturing group, counted without executing it against `str` (a
        // regex appended with an empty `|` alternative always matches the empty string, so `.exec("")`'s result
        // array length - 1 gives the group count regardless of whether the original pattern would ever match).
        // A plain `string` `match` compiles to a group-less regex, so this is always `false` in that case.
        const hasCaptureGroup = new RegExp(global.source + "|").exec("")!.length > 1;

        // A function replacer is used, receiving the full match plus every captured group in order. Without
        // checking `hasCaptureGroup` first, a pattern with no capturing group would still receive a value in
        // the "capture" position per String.prototype.replace's callback signature - but that value is the
        // match's numeric *offset*, not `undefined`, silently corrupting the output (e.g. replaceAll("hello
        // world", "o", "_") would embed "4"/"7" from the offsets instead of doing a plain substring
        // replacement). With no capture group there's no "inner" text distinct from the match to preserve, so
        // the whole match is simply replaced by `prefix` - i.e. ordinary search-and-replace semantics.
        return str.replace(global, (...args: any[]) => {
            const capture = hasCaptureGroup ? args[1] : "";
            return prefix + capture;
        });
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
