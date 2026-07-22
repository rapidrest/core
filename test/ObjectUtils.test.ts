///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import { ObjectDecorators } from "../src/decorators";
import { RequiresScope } from "../src/decorators/ObjectDecorators";
import { JWTUser } from "../src/JWTUtils";
import { ObjectUtils } from "../src/ObjectUtils";
import { ValidationUtils } from "../src/ValidationUtils";
const { Nullable, Validator } = ObjectDecorators;
import { v4 as uuidV4 } from "uuid";
import { describe, it, expect } from "vitest";

class TestScopeClass {
    public uid: string = uuidV4();

    public name: string = "username";

    @RequiresScope("profile")
    public givenName: string = "John";

    @RequiresScope("profile")
    public familyName: string = "Smith";

    @RequiresScope("email")
    public email: string = "john.smith@gmail.com";

    public version: number = 0;
}

class TestValidationClass {
    @Validator(ValidationUtils.checkUUID)
    public uid: string = uuidV4();

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
    const jwtConfig = {
        secret: "MyPasswordIsSecure",
        options: {
            audience: "rapidrest.dev",
            issuer: "rapidrest.dev",
        },
    };

    it("Can read scoped properties with user scopes [profile, email].", () => {
        let testObj: TestScopeClass = new TestScopeClass();
        const user: JWTUser = {
            uid: uuidV4(),
            name: "testuser",
            roles: [],
            scopes: ["profile", "email"],
        };
        ObjectUtils.deleteScopedProps(testObj, user, TestScopeClass);
        expect(testObj).toHaveProperty("givenName");
        expect(testObj.givenName).toBe("John");
        expect(testObj).toHaveProperty("familyName");
        expect(testObj.familyName).toBe("Smith");
        expect(testObj).toHaveProperty("email");
        expect(testObj.email).toBe("john.smith@gmail.com");
    });

    it("Can read scoped properties with user scopes [profile].", () => {
        let testObj: TestScopeClass = new TestScopeClass();
        const user: JWTUser = {
            uid: uuidV4(),
            name: "testuser",
            roles: [],
            scopes: ["profile"],
        };
        ObjectUtils.deleteScopedProps(testObj, user, TestScopeClass);
        expect(testObj).toHaveProperty("givenName");
        expect(testObj.givenName).toBe("John");
        expect(testObj).toHaveProperty("familyName");
        expect(testObj.familyName).toBe("Smith");
        expect(testObj).not.toHaveProperty("email");
    });

    it("Cannot read scoped properties without user scopes [profile,email].", () => {
        let testObj: TestScopeClass = new TestScopeClass();
        const user: JWTUser = {
            uid: uuidV4(),
            name: "testuser",
            roles: [],
            scopes: [],
        };
        ObjectUtils.deleteScopedProps(testObj, user, TestScopeClass);
        expect(testObj).not.toHaveProperty("givenName");
        expect(testObj).not.toHaveProperty("familyName");
        expect(testObj).not.toHaveProperty("email");
    });

    it("Can process an array of objects for scope deletion.", () => {
        const user: JWTUser = {
            uid: uuidV4(),
            name: "testuser",
            roles: [],
            scopes: [],
        };
        const objs: TestScopeClass[] = [new TestScopeClass(), new TestScopeClass()];
        ObjectUtils.deleteScopedProps(objs, user, TestScopeClass);
        for (const obj of objs) {
            expect(obj).not.toHaveProperty("givenName");
            expect(obj).not.toHaveProperty("email");
        }
    });

    it("Constructs a fresh clazz instance to read metadata when obj is not already an instance of clazz.", () => {
        const user: JWTUser = {
            uid: uuidV4(),
            name: "testuser",
            roles: [],
            scopes: [],
        };
        // A plain object literal is not `instanceof TestScopeClass`, forcing deleteScopedProps to build
        // `new clazz()` purely to read the @RequiresScope metadata off its prototype.
        const plainObj: any = { name: "username", givenName: "John", email: "john.smith@gmail.com" };
        ObjectUtils.deleteScopedProps(plainObj, user, TestScopeClass);
        expect(plainObj).not.toHaveProperty("givenName");
        expect(plainObj).not.toHaveProperty("email");
        expect(plainObj).toHaveProperty("name");
    });

    it("Skips the 'constructor' own property during scope deletion.", () => {
        const user: JWTUser = {
            uid: uuidV4(),
            name: "testuser",
            roles: [],
            scopes: [],
        };
        const obj: any = { constructor: "not-a-real-constructor", givenName: "John" };
        expect(Object.getOwnPropertyNames(obj)).toContain("constructor");
        ObjectUtils.deleteScopedProps(obj, user, undefined);
        expect(obj.constructor).toBe("not-a-real-constructor");
    });

    it("Recurses into nested object properties when recurse is true.", () => {
        const user: JWTUser = {
            uid: uuidV4(),
            name: "testuser",
            roles: [],
            scopes: [],
        };
        const obj: any = {
            name: "outer",
            nested: new TestScopeClass(),
        };
        ObjectUtils.deleteScopedProps(obj, user, undefined, true);
        expect(obj.nested).not.toHaveProperty("givenName");
        expect(obj.nested).not.toHaveProperty("email");
    });

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
        testObj.uid = uuidV4();
        testObj.date = undefined;
        ObjectUtils.validate(testObj);
    });

    it("Can validate delta object.", () => {
        ObjectUtils.validate(
            {
                uid: uuidV4(),
                date: new Date(),
                semver: "1.0.0",
            },
            TestValidationClass,
        );
        try {
            ObjectUtils.validate(
                {
                    udi: uuidV4(),
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

    it("Skips the 'constructor' own property during validation.", () => {
        const obj: any = { constructor: "not-a-real-constructor", uid: uuidV4(), semver: "1.0.0" };
        expect(Object.getOwnPropertyNames(obj)).toContain("constructor");
        ObjectUtils.validate(obj);
    });

    it("Can validate with recursion requested.", () => {
        const obj: any = {
            uid: uuidV4(),
            semver: "1.0.0",
            nested: {
                foo: "bar",
            },
        };
        // The recursive call used to pass `recurse` positionally as the `clazz` argument, which made the nested
        // invocation attempt `obj instanceof recurse` (e.g. `obj instanceof true`) and throw a TypeError for any
        // object with a nested property. Fixed to pass `undefined` for `clazz` so recursion actually validates.
        expect(() => ObjectUtils.validate(obj, undefined, true)).not.toThrow();
    });

    it("Recursion validates nested object properties and reports failures from the nested object.", () => {
        const obj: any = {
            uid: uuidV4(),
            semver: "1.0.0",
            nested: {
                foo: null,
            },
        };
        expect(() => ObjectUtils.validate(obj, undefined, true)).toThrow("Property foo cannot be null.");
    });
});
