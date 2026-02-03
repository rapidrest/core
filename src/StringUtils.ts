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

        // Go through all variables and perform replacement
        for (let key in variables) {
            // Perform replacement on the variable value itself. This allows nested variable replacement.
            if (variables[key]) {
                let value: string = variables[key] as string;
                for (let key2 in variables) {
                    if (variables[key2]) {
                        let value2 = variables[key2] as string;
                        value = value.toString().replace(new RegExp("(\\{\\{" + key2 + "\\}\\})", "g"), value2);
                    }
                }

                output = output.replace(new RegExp("(\\{\\{" + key + "\\}\\})", "g"), value);
            }
        }

        return output;
    }

    /**
     * Replaces all instances of the match regex pattern with the contents of the inner regular expression pattern for
     * the given string.
     *
     * e.g.
     * 
     * let result = replaceAll('/my/path/{id}', new RegExp('\\{([^\\}]+)\\}'), ':');
     * console.log(result); // -> /my/path/:id
     *
     * @param {string} str The string to perform replacement on.
     * @param {RegExp} match The regular expression pattern to match containing an outer and inner pattern.
     * @param {string} prefix The prefix to prepend the replacement text with.
     * @returns {string} The fully replaced contents of the string.
     */
    public static replaceAll(str: string, match: string | RegExp, prefix: string): string {
        let result = str;

        let matches = str.match(match);
        while (matches) {
            result = result.replace(matches[0], prefix + matches[1]);
            matches = result.match(match);
        }

        return result;
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
