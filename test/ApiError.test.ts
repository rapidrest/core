///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import { ApiError } from "../src/ApiError.js";
import { describe, it, expect } from "vitest";

describe("ApiError Tests.", () => {
    it("Can create error with no message.", () => {
        const err = new ApiError("ERR_CODE", 404);
        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(ApiError);
        expect(err.code).toBe("ERR_CODE");
        expect(err.status).toBe(404);
        expect(err.message).toBe("");
    });

    it("Can create error with a plain message.", () => {
        const err = new ApiError("ERR_CODE", 400, "Something went wrong.");
        expect(err.message).toBe("Something went wrong.");
    });

    it("Can create error with a templated message.", () => {
        const err = new ApiError("ERR_CODE", 400, "Hello {{name}}, code {{code}}.", {
            name: "World",
            code: "42",
        });
        expect(err.message).toBe("Hello World, code 42.");
    });

    it("Swallows errors raised while templating the message.", () => {
        // Passing a non-string truthy `message` with truthy `templateVariables` forces
        // StringUtils.findAndReplace to call `.replace` on a non-string, throwing internally.
        // The constructor's try/catch should swallow this rather than propagating.
        expect(() => {
            new ApiError("ERR_CODE", 500, 12345 as any, { foo: "bar" });
        }).not.toThrow();
    });
});
