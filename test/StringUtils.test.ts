///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import { StringUtils } from "../src/StringUtils.js";
import { describe, it, expect } from "vitest";

describe("StringUtils Tests.", () => {
    it("getParameters returns successfully.", () => {
        let result = StringUtils.getParameters("/my/{key}/with/{id}");
        expect(result).toBeInstanceOf(Array);
        expect(result).toHaveLength(2);
        expect(result[0]).toBe("key");
        expect(result[1]).toBe("id");
    });

    it("getParameters returns empty when a brace is unclosed.", () => {
        let result = StringUtils.getParameters("/my/{unclosed");
        expect(result).toBeInstanceOf(Array);
        expect(result).toHaveLength(0);
    });

    it("getParameters returns empty when there are no braces.", () => {
        let result = StringUtils.getParameters("/my/path/no/braces");
        expect(result).toBeInstanceOf(Array);
        expect(result).toHaveLength(0);
    });

    it("findAndReplace returns successfully.", () => {
        let map = {
            adjective: "lazy",
            animal1: "Fox",
            animal2: "{{adjective}} Dog",
            color: "brown",
        };
        let result = StringUtils.findAndReplace("The quick {{color}} {{animal1}} jumped over the {{animal2}}.", map);
        expect(result).toBe("The quick brown Fox jumped over the lazy Dog.");
    });

    it("findAndReplace substitutes falsy-but-defined variable values instead of skipping them.", () => {
        let map = {
            adjective: "lazy",
            animal1: "",
            count: 0,
            color: "brown",
        };
        let result = StringUtils.findAndReplace(
            "The quick {{color}} {{animal1}} jumped {{count}} times over the {{adjective}} dog.",
            map
        );
        expect(result).toBe("The quick brown  jumped 0 times over the lazy dog.");
    });

    it("findAndReplace replaces the placeholder with an empty string when a variable is undefined or null.", () => {
        let map = {
            adjective: "lazy",
            animal1: undefined,
            animal2: null,
            color: "brown",
        };
        let result = StringUtils.findAndReplace(
            "The quick {{color}} {{animal1}} jumped over the {{animal2}} {{adjective}} dog.",
            map as any,
        );
        expect(result).toBe("The quick brown  jumped over the  lazy dog.");
    });

    it("findAndReplace leaves a literal '{{}}' untouched when no variables are given.", () => {
        // With an empty `variables` map the combined regex's alternation is empty, reducing the pattern to
        // literally `\{\{()\}\}` - which still matches a literal "{{}}" in `contents` with an empty capture
        // group. Since "" is never a key in `resolved` (there are no keys at all), this exercises the `?? _full`
        // fallback that leaves an unmatched placeholder untouched instead of throwing or substituting undefined.
        let result = StringUtils.findAndReplace("Hello {{}} World", {});
        expect(result).toBe("Hello {{}} World");
    });

    it("replaceAll returns successfully.", () => {
        let result = StringUtils.replaceAll("/my/{uid}/child/{childid}", new RegExp("\\{([^\\}]+)\\}"), ":");
        expect(result).toBe("/my/:uid/child/:childid");
    });

    it("replaceAll returns successfully with a global regular expression.", () => {
        let result = StringUtils.replaceAll("/my/{uid}/child/{childid}", new RegExp("\\{([^\\}]+)\\}", "g"), ":");
        expect(result).toBe("/my/:uid/child/:childid");
    });

    it("replaceAll returns successfully with a string pattern.", () => {
        // The pattern "X" has no capture group, so there's no "inner" text distinct from the match to
        // preserve - each match is replaced by `prefix` alone, i.e. ordinary search-and-replace.
        let result = StringUtils.replaceAll("aXbXc", "X", "-");
        expect(result).toBe("a-b-c");
    });

    it("replaceAll returns successfully with a capture-less regular expression.", () => {
        // Same no-capture-group behavior as the string-pattern case above, but via an explicit RegExp input.
        let result = StringUtils.replaceAll("hello world", /o/g, "0");
        expect(result).toBe("hell0 w0rld");
    });

    it("toCamelCase returns successfully.", () => {
        expect(StringUtils.toCamelCase("myString")).toBe("myString");
        expect(StringUtils.toCamelCase("MyString")).toBe("myString");
        expect(StringUtils.toCamelCase("MYSTRING")).toBe("mYSTRING");
        expect(StringUtils.toCamelCase("1abc")).toBe("1abc");
    });

    it("toPascalCase returns successfully.", () => {
        expect(StringUtils.toPascalCase("myString")).toBe("MyString");
        expect(StringUtils.toPascalCase("MyString")).toBe("MyString");
        expect(StringUtils.toPascalCase("MYSTRING")).toBe("MYSTRING");
        expect(StringUtils.toPascalCase("mystring")).toBe("Mystring");
        expect(StringUtils.toPascalCase("1abc")).toBe("1abc");
    });
});
