///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { JWTUtils, JWTUtilsCompressionMethods, JWTPayload } from "../src/JWTUtils.js";
import { describe, it, expect, vi } from "vitest";
describe("JWTUtils Tests.", () => {
    const testUser = {
        uid: "2dfbae90-7965-461a-b265-d904fad9b2d7",
        name: "test@gmail.com",
        roles: ["role1", "role2"],
        verified: true
    };
    const config = {
        secret: "MyPasswordIsSecure",
        options: {
            audience: "rapidrest.dev",
            issuer: "rapidrest.dev",
        },
    };
    const compressConfig = {
        secret: "MyPasswordIsSecure",
        options: {
            audience: "rapidrest.dev",
            issuer: "rapidrest.dev",
        },
        payload: {
            compress: JWTUtilsCompressionMethods.ZLIB,
            encrypt: false,
        },
    };
    const encryptConfig = {
        secret: "MyPasswordIsSecure",
        options: {
            audience: "rapidrest.dev",
            issuer: "rapidrest.dev",
        },
        payload: {
            compress: undefined,
            encrypt: true,
            iv: crypto.randomBytes(16),
            algorithm: "aes-192-cbc",
            password: "MyPasswordIsSecure",
        },
    };
    // Generated at test-time (rather than a hardcoded fixture) so the public key is guaranteed to be in a PEM/SPKI
    // format that `crypto.publicEncrypt`/`crypto.privateDecrypt` can actually consume.
    const { publicKey: rsaPublicKey, privateKey: rsaPrivateKey } = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs1", format: "pem" },
    });
    const encryptKeyConfig = {
        secret: "MyPasswordIsSecure",
        options: {
            audience: "rapidrest.dev",
            issuer: "rapidrest.dev",
        },
        payload: {
            compress: undefined,
            encrypt: true,
            algorithm: "aes-192-cbc",
            iv: crypto.randomBytes(16),
            private_key: rsaPrivateKey,
            public_key: rsaPublicKey,
        },
    };

    it("Can create JWT token.", async () => {
        let token = await JWTUtils.createToken(config, testUser);
        expect(token).toBeDefined();
        expect(() => {
            jwt.verify(token, config.secret, config.options);
        }).not.toThrow();
    });

    it("Can create compressed JWT token.", async () => {
        let token = await JWTUtils.createToken(compressConfig, testUser);
        expect(token).toBeDefined();
        expect(() => {
            jwt.verify(token, config.secret, config.options);
        }).not.toThrow();
    });

    it("Can create encrypted JWT token.", async () => {
        let token = await JWTUtils.createToken(encryptConfig, testUser);
        expect(token).toBeDefined();
        const payload: any = jwt.verify(token, encryptConfig.secret, encryptConfig.options);
        expect(payload).toBeDefined();
    });

    it("Can create encrypted JWT token with public/private keys.", async () => {
        let token = await JWTUtils.createToken(encryptKeyConfig, testUser);
        expect(token).toBeDefined();
        const payload: any = jwt.verify(token, encryptKeyConfig.secret, encryptKeyConfig.options);
        expect(payload).toBeDefined();
    });

    it("Can create JWT token. (sync)", () => {
        let token = JWTUtils.createTokenSync(config, testUser);
        expect(token).toBeDefined();
        expect(() => {
            jwt.verify(token, config.secret, config.options);
        }).not.toThrow();
    });

    it("Can create compressed JWT token. (sync)", () => {
        let token = JWTUtils.createTokenSync(compressConfig, testUser);
        expect(token).toBeDefined();
        expect(() => {
            jwt.verify(token, config.secret, config.options);
        }).not.toThrow();
    });

    it("Can create encrypted JWT token. (sync)", () => {
        let token = JWTUtils.createTokenSync(encryptConfig, testUser);
        expect(token).toBeDefined();
        const payload: any = jwt.verify(token, encryptConfig.secret, encryptConfig.options);
        expect(payload).toBeDefined();
    });

    it("Can create encrypted JWT token with public/private keys. (sync)", () => {
        let token = JWTUtils.createTokenSync(encryptKeyConfig, testUser);
        expect(token).toBeDefined();
        const payload: any = jwt.verify(token, encryptKeyConfig.secret, encryptKeyConfig.options);
        expect(payload).toBeDefined();
    });

    it("Can decode JWT token.", async () => {
        const token = await JWTUtils.createToken(config, testUser);
        expect(token).toBeDefined();
        jwt.verify(token, config.secret, config.options);
        const payload: JWTPayload = await JWTUtils.decodeToken(config, token);
        expect(payload.profile).toEqual(testUser);
    });

    it("Can decode compressed JWT token.", async () => {
        const token = await JWTUtils.createToken(compressConfig, testUser);
        expect(token).toBeDefined();
        jwt.verify(token, compressConfig.secret, compressConfig.options);
        const payload: JWTPayload = await JWTUtils.decodeToken(compressConfig, token);
        expect(payload.profile).toEqual(testUser);
        expect(payload.compression).toBe(JWTUtilsCompressionMethods.ZLIB);
    });

    it("Can decode encrypted JWT token.", async () => {
        const token = await JWTUtils.createToken(encryptConfig, testUser);
        expect(token).toBeDefined();
        jwt.verify(token, encryptConfig.secret, encryptConfig.options);
        const payload: JWTPayload = await JWTUtils.decodeToken(encryptConfig, token);
        expect(payload.profile).toEqual(testUser);
        expect(payload.encryption).toBeTruthy();
    });

    it("Can decode encrypted JWT token with public/private keys.", async () => {
        const token = await JWTUtils.createToken(encryptKeyConfig, testUser);
        expect(token).toBeDefined();
        jwt.verify(token, encryptKeyConfig.secret, encryptKeyConfig.options);
        const payload: JWTPayload = await JWTUtils.decodeToken(encryptKeyConfig, token);
        expect(payload.profile).toEqual(testUser);
        expect(payload.encryption).toBeTruthy();
    });

    it("Can decode JWT token. (sync)", () => {
        const token = JWTUtils.createTokenSync(config, testUser);
        expect(token).toBeDefined();
        jwt.verify(token, config.secret, config.options);
        const payload: JWTPayload = JWTUtils.decodeTokenSync(config, token);
        expect(payload.profile).toEqual(testUser);
    });

    it("Can decode compressed JWT token. (sync)", () => {
        const token = JWTUtils.createTokenSync(compressConfig, testUser);
        expect(token).toBeDefined();
        jwt.verify(token, compressConfig.secret, compressConfig.options);
        const payload: JWTPayload = JWTUtils.decodeTokenSync(compressConfig, token);
        expect(payload.profile).toEqual(testUser);
        expect(payload.compression).toBe(JWTUtilsCompressionMethods.ZLIB);
    });

    it("Can decode encrypted JWT token. (sync)", () => {
        const token = JWTUtils.createTokenSync(encryptConfig, testUser);
        expect(token).toBeDefined();
        jwt.verify(token, encryptConfig.secret, encryptConfig.options);
        const payload: JWTPayload = JWTUtils.decodeTokenSync(encryptConfig, token);
        expect(payload.profile).toEqual(testUser);
        expect(payload.encryption).toBeTruthy();
    });

    it("Can decode encrypted JWT token with public/private keys. (sync)", () => {
        const token = JWTUtils.createTokenSync(encryptKeyConfig, testUser);
        expect(token).toBeDefined();
        jwt.verify(token, encryptKeyConfig.secret, encryptKeyConfig.options);
        const payload: JWTPayload = JWTUtils.decodeTokenSync(encryptKeyConfig, token);
        expect(payload.profile).toEqual(testUser);
        expect(payload.encryption).toBeTruthy();
    });

    it("Cannot create JWT token without a secret.", async () => {
        await expect(JWTUtils.createToken({ ...config, secret: undefined as any }, testUser)).rejects.toThrow(
            "Invalid configuration provided.",
        );
    });

    it("Cannot create JWT token without a valid user.", async () => {
        await expect(JWTUtils.createToken(config, undefined as any)).rejects.toThrow(
            "Invalid or null user object provided.",
        );
        await expect(JWTUtils.createToken(config, {} as any)).rejects.toThrow("Invalid or null user object provided.");
    });

    it("Cannot create JWT token without a secret. (sync)", () => {
        expect(() => JWTUtils.createTokenSync({ ...config, secret: undefined as any }, testUser)).toThrow(
            "Invalid configuration provided.",
        );
    });

    it("Cannot create JWT token without a valid user. (sync)", () => {
        expect(() => JWTUtils.createTokenSync(config, undefined as any)).toThrow("Invalid or null user object provided.");
        expect(() => JWTUtils.createTokenSync(config, {} as any)).toThrow("Invalid or null user object provided.");
    });

    it("Cannot use an asymmetric secret without restricting algorithms.", async () => {
        const unsafeConfig = { secret: rsaPrivateKey };
        await expect(JWTUtils.createToken(unsafeConfig, testUser)).rejects.toThrow(
            "config.secret appears to be an asymmetric key.",
        );
        expect(() => JWTUtils.createTokenSync(unsafeConfig, testUser)).toThrow(
            "config.secret appears to be an asymmetric key.",
        );
        expect(() => JWTUtils.decodeTokenSync(unsafeConfig, "not-a-real-token")).toThrow(
            "config.secret appears to be an asymmetric key.",
        );
        await expect(JWTUtils.decodeToken(unsafeConfig, "not-a-real-token")).rejects.toThrow(
            "config.secret appears to be an asymmetric key.",
        );
    });

    it("Cannot decode a token with a missing or invalid payload.", async () => {
        const badToken = jwt.sign({}, config.secret, config.options);
        await expect(JWTUtils.decodeToken(config, badToken)).rejects.toThrow("Token is invalid or missing data.");
        expect(() => JWTUtils.decodeTokenSync(config, badToken)).toThrow("Token is invalid or missing data.");
    });

    it("Cannot use an asymmetric secret with an explicitly empty algorithms list.", async () => {
        const unsafeConfig = { secret: rsaPrivateKey, options: { algorithms: [] } };
        await expect(JWTUtils.createToken(unsafeConfig, testUser)).rejects.toThrow(
            "config.secret appears to be an asymmetric key.",
        );
    });

    it("Ignores an unrecognized compression method.", async () => {
        const bogusCompressConfig = {
            secret: "MyPasswordIsSecure",
            options: { audience: "rapidrest.dev", issuer: "rapidrest.dev" },
            payload: { compress: "bogus" as any },
        };
        const token = await JWTUtils.createToken(bogusCompressConfig, testUser);
        const payload: JWTPayload = await JWTUtils.decodeToken(bogusCompressConfig, token);
        expect(payload.compression).toBeUndefined();
        expect(payload.profile).toEqual(testUser);

        const tokenSync = JWTUtils.createTokenSync(bogusCompressConfig, testUser);
        const payloadSync: JWTPayload = JWTUtils.decodeTokenSync(bogusCompressConfig, tokenSync);
        expect(payloadSync.compression).toBeUndefined();
        expect(payloadSync.profile).toEqual(testUser);
    });

    it("Propagates a scrypt derivation error.", async () => {
        const scryptSpy = vi
            .spyOn(crypto, "scrypt")
            .mockImplementation(((...args: any[]) => {
                const callback = args[args.length - 1];
                callback(new Error("scrypt failed"));
            }) as any);

        await expect(JWTUtils.createToken(encryptConfig, testUser)).rejects.toThrow("scrypt failed");

        scryptSpy.mockRestore();
    });
});
