///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import { ObjectDecorators } from "../src/decorators";
import { ObjectUtils } from "../src/ObjectUtils";
import { ValidationUtils } from "../src/ValidationUtils";
const { Nullable, Validator } = ObjectDecorators;
const uuid = require("uuid");
import { describe, it, expect } from "vitest";

class TestValidationClass {
    @Validator(ValidationUtils.checkUUID)
    public uid: string = uuid.v4();

    @Validator(ValidationUtils.checkName)
    public name: string = "username";

    @Nullable
    @Validator(ValidationUtils.checkDate)
    public date?: Date = new Date();

    @Validator(ValidationUtils.checkSemVer)
    public semver: string = "1.0.0";

    public version: number = 0;
}

describe("ObjectUtils Tests", () => {
    it("Can validate object.", () => {
        let testObj: TestValidationClass = new TestValidationClass();
        ObjectUtils.validate(testObj);
        testObj.name = "john.smith@gmail.com";
        ObjectUtils.validate(testObj);
        testObj.semver = "";
        try {
            ObjectUtils.validate(testObj);
        } catch (err: any) {
            expect(err.message).toBe("Property semver cannot be null.");
        }
        testObj.name = "my-test_user+210248@nowhere.com.us";
        testObj.semver = "1.0.0";
        ObjectUtils.validate(testObj);
        testObj.uid = "blah-blah";
        try {
            ObjectUtils.validate(testObj);
        } catch (err: any) {
            expect(err.message).toBe("Property uid is invalid. Value is not a UUID.");
        }
        testObj.uid = uuid.v4();
        testObj.date = undefined;
        ObjectUtils.validate(testObj);
    });

    it("Can validate delta object.", () => {
        ObjectUtils.validate(
            {
                uid: uuid.v4(),
                date: new Date(),
                semver: "1.0.0",
            },
            TestValidationClass,
        );
        try {
            ObjectUtils.validate(
                {
                    udi: uuid.v4(),
                    semver: "",
                },
                TestValidationClass,
            );
        } catch (err: any) {
            expect(err.message).toBe("Property semver cannot be null.");
        }
        try {
            ObjectUtils.validate(
                {
                    uid: "blah-blah",
                    semver: "1.0.0",
                },
                TestValidationClass,
            );
        } catch (err: any) {
            expect(err.message).toBe("Property uid is invalid. Value is not a UUID.");
        }
    });

    it("Can validate array of objects.", () => {
        const objs: any[] = [];
        for (let i = 0; i < 5; i++) {
            objs.push(new TestValidationClass());
        }
        ObjectUtils.validate(objs);
    });
});
