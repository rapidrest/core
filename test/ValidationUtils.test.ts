///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import { ValidationUtils } from "../src/ValidationUtils.js";
import { v4 as uuidV4 } from "uuid";
import { describe, it, expect } from "vitest";

describe("ValidationUtils Tests.", () => {
    it("check succeeds and fails.", () => {
        const isPositive = (val: any) => val > 0;
        expect(ValidationUtils.check(5, isPositive)).toBe(5);
        expect(() => ValidationUtils.check(-5, isPositive)).toThrow("Value failed validation");
    });

    it("checkDate succeeds and fails.", () => {
        expect(ValidationUtils.checkDate("2024-01-01")).toBe("2024-01-01");
        expect(() => ValidationUtils.checkDate("not-a-date")).toThrow("Value is not a Date.");
    });

    it("checkEmail succeeds and fails.", () => {
        expect(ValidationUtils.checkEmail("test@example.com")).toBe("test@example.com");
        expect(() => ValidationUtils.checkEmail("not-an-email")).toThrow("Value is not a valid email addresss.");
    });

    it("checkEmpty succeeds and fails.", () => {
        expect(ValidationUtils.checkEmpty(["a"])).toEqual(["a"]);
        expect(() => ValidationUtils.checkEmpty([])).toThrow("Value cannot be empty.");
    });

    it("checkEmpty throws for null/undefined instead of silently returning them.", () => {
        expect(() => ValidationUtils.checkEmpty(null as any)).toThrow("Value cannot be empty.");
        expect(() => ValidationUtils.checkEmpty(undefined as any)).toThrow("Value cannot be empty.");
    });

    it("checkIP succeeds and fails.", () => {
        expect(ValidationUtils.checkIP("127.0.0.1")).toBe("127.0.0.1");
        expect(() => ValidationUtils.checkIP("not-an-ip")).toThrow("Value is not a valid IP address.");
    });

    it("checkJSON succeeds and fails.", () => {
        expect(ValidationUtils.checkJSON('{"a":1}')).toBe('{"a":1}');
        expect(() => ValidationUtils.checkJSON("not-json")).toThrow("Value is not valid JSON.");
    });

    it("checkName succeeds and fails.", () => {
        expect(ValidationUtils.checkName("my-name_1.test@:+")).toBe("my-name_1.test@:+");
        expect(() => ValidationUtils.checkName("invalid name!")).toThrow(
            "Value is not a name matching pattern",
        );
    });

    it("checkNull succeeds and fails.", () => {
        expect(ValidationUtils.checkNull("value")).toBe("value");
        expect(ValidationUtils.checkNull(false)).toBe(false);
        expect(ValidationUtils.checkNull(true)).toBe(true);
        // `0` is a valid, non-null value (matching `ObjectUtils.validate`'s own nullable convention).
        expect(ValidationUtils.checkNull(0)).toBe(0);
        expect(() => ValidationUtils.checkNull(null)).toThrow("Value cannot be null.");
        expect(() => ValidationUtils.checkNull(undefined)).toThrow("Value cannot be null.");
        expect(() => ValidationUtils.checkNull("")).toThrow("Value cannot be null.");
    });

    it("checkPhone succeeds and fails.", () => {
        expect(ValidationUtils.checkPhone("+14155552671")).toBe("+14155552671");
        expect(() => ValidationUtils.checkPhone("not-a-phone")).toThrow("Value is not a valid phone number.");
    });

    it("checkSemVer succeeds and fails.", () => {
        expect(ValidationUtils.checkSemVer("1.0.0")).toBe("1.0.0");
        expect(() => ValidationUtils.checkSemVer("not-semver")).toThrow("Value is not a valid semantic version.");
    });

    it("checkURL succeeds and fails.", () => {
        expect(ValidationUtils.checkURL("https://rapidrest.dev")).toBe("https://rapidrest.dev");
        expect(() => ValidationUtils.checkURL("not a url")).toThrow("Value is not a URL.");
    });

    it("checkUUID succeeds and fails.", () => {
        const uid = uuidV4();
        expect(ValidationUtils.checkUUID(uid)).toBe(uid);
        expect(() => ValidationUtils.checkUUID("not-a-uuid")).toThrow("Value is not a UUID.");
    });

    it("checkVersion returns non-negative numbers.", () => {
        expect(ValidationUtils.checkVersion(5)).toBe(5);
        expect(ValidationUtils.checkVersion("5")).toBe(5);
        expect(ValidationUtils.checkVersion(-5)).toBe(0);
        expect(ValidationUtils.checkVersion(0)).toBe(0);
    });

    it("checkVersion throws for non-numeric input instead of silently returning NaN.", () => {
        expect(() => ValidationUtils.checkVersion("not-a-number")).toThrow("Value is not a valid version number.");
    });

    it("checkVersion throws for empty/whitespace/null/empty-array input instead of silently coercing to 0.", () => {
        // `Number()` coerces each of these to `0` rather than `NaN`, which would otherwise let missing or
        // malformed input silently through as a "valid" version 0.
        expect(() => ValidationUtils.checkVersion("")).toThrow("Value is not a valid version number.");
        expect(() => ValidationUtils.checkVersion("   ")).toThrow("Value is not a valid version number.");
        expect(() => ValidationUtils.checkVersion(null)).toThrow("Value is not a valid version number.");
        expect(() => ValidationUtils.checkVersion([])).toThrow("Value is not a valid version number.");
        // `undefined` already throws via the existing NaN check (`Number(undefined)` is `NaN`).
        expect(() => ValidationUtils.checkVersion(undefined)).toThrow("Value is not a valid version number.");
    });
});
