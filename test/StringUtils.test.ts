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

    it("findAndReplace skips replacement for falsy variable values.", () => {
        let map = {
            adjective: "lazy",
            animal1: "",
            color: "brown",
        };
        let result = StringUtils.findAndReplace(
            "The quick {{color}} {{animal1}} jumped over the {{adjective}} dog.",
            map
        );
        expect(result).toBe("The quick brown {{animal1}} jumped over the lazy dog.");
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
        // Note: since the pattern "X" has no capture group, the replace callback's `capture` argument is the
        // match offset (per String.prototype.replace semantics), not the matched text.
        let result = StringUtils.replaceAll("aXbXc", "X", "-");
        expect(result).toBe("a-1b-3c");
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
