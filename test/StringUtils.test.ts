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

    it("replaceAll returns successfully.", () => {
        let result = StringUtils.replaceAll("/my/{uid}/child/{childid}", new RegExp("\\{([^\\}]+)\\}"), ":");
        expect(result).toBe("/my/:uid/child/:childid");
    });

    it("toCamelCase returns successfully.", () => {
        expect(StringUtils.toCamelCase("myString")).toBe("myString");
        expect(StringUtils.toCamelCase("MyString")).toBe("myString");
        expect(StringUtils.toCamelCase("MYSTRING")).toBe("mYSTRING");
    });

    it("toPascalCase returns successfully.", () => {
        expect(StringUtils.toPascalCase("myString")).toBe("MyString");
        expect(StringUtils.toPascalCase("MyString")).toBe("MyString");
        expect(StringUtils.toPascalCase("MYSTRING")).toBe("MYSTRING");
        expect(StringUtils.toPascalCase("mystring")).toBe("Mystring");
    });
});
