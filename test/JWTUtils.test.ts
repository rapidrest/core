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
    const encryptGcmConfig = {
        secret: "MyPasswordIsSecure",
        options: {
            audience: "rapidrest.dev",
            issuer: "rapidrest.dev",
        },
        payload: {
            compress: undefined,
            encrypt: true,
            // aes-192-gcm (rather than aes-256) to match deriveKey()'s fixed 24-byte scrypt output, same as the
            // other password-based configs above use via aes-192-cbc.
            iv: crypto.randomBytes(12),
            algorithm: "aes-192-gcm",
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

    it("Can create and decode a JWT token encrypted with an AEAD cipher (aes-256-gcm).", async () => {
        const token = await JWTUtils.createToken(encryptGcmConfig, testUser);
        expect(token).toBeDefined();
        jwt.verify(token, encryptGcmConfig.secret, encryptGcmConfig.options);
        const payload: JWTPayload = await JWTUtils.decodeToken(encryptGcmConfig, token);
        expect(payload.profile).toEqual(testUser);
        expect(payload.encryption).toBeTruthy();
    });

    it("Rejects a tampered auth tag when decoding an AEAD-encrypted JWT token.", async () => {
        const token = await JWTUtils.createToken(encryptGcmConfig, testUser);
        const decoded: any = jwt.decode(token);
        const [saltB64, authTagB64, ciphertext] = (decoded.profile as string).split(":");
        const tamperedTag = Buffer.from(authTagB64, "base64");
        tamperedTag[0] ^= 0xff;
        decoded.profile = `${saltB64}:${tamperedTag.toString("base64")}:${ciphertext}`;
        // No `options` passed here: `decoded` already carries the `aud`/`iss`/`iat`/`exp` claims from the
        // original signing, and jwt.sign() rejects an `options.audience`/`issuer` that conflicts with a
        // payload that already has `aud`/`iss` set.
        const tamperedToken = jwt.sign(decoded, encryptGcmConfig.secret);
        await expect(JWTUtils.decodeToken(encryptGcmConfig, tamperedToken)).rejects.toThrow();
    });

    it("Throws a clear error for a legacy 2-part password-encrypted payload (pre-auth-tag format).", async () => {
        // Simulates a token issued before the AEAD auth-tag fix, whose payload.profile is `<salt>:<ciphertext>`
        // instead of the current `<salt>:<authTag>:<ciphertext>`. Must fail with a clear, actionable error
        // rather than an opaque JSON.parse SyntaxError from finalizePayload() decoding still-encrypted data.
        const legacyPayload = {
            profile: "c29tZXNhbHQ=:c29tZWNpcGhlcnRleHQ=",
            encryption: true,
            sessionUid: "s1",
        };
        const token = jwt.sign(legacyPayload, encryptConfig.secret, encryptConfig.options);
        await expect(JWTUtils.decodeToken(encryptConfig, token)).rejects.toThrow(
            "unrecognized or outdated encrypted format",
        );
        expect(() => JWTUtils.decodeTokenSync(encryptConfig, token)).toThrow(
            "unrecognized or outdated encrypted format",
        );
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

    it("Can create and decode a JWT token encrypted with an AEAD cipher (aes-256-gcm). (sync)", () => {
        const token = JWTUtils.createTokenSync(encryptGcmConfig, testUser);
        expect(token).toBeDefined();
        jwt.verify(token, encryptGcmConfig.secret, encryptGcmConfig.options);
        const payload: JWTPayload = JWTUtils.decodeTokenSync(encryptGcmConfig, token);
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

    it("Cannot use an asymmetric secret loaded as a Buffer (e.g. via fs.readFileSync) without restricting algorithms.", async () => {
        // fs.readFileSync() - the idiomatic way to load a key file - returns a Buffer, not a string. The
        // algorithm-confusion guard must catch this form too, not just string secrets.
        const unsafeConfig = { secret: Buffer.from(rsaPrivateKey, "utf8") };
        await expect(JWTUtils.createToken(unsafeConfig, testUser)).rejects.toThrow(
            "config.secret appears to be an asymmetric key.",
        );
        expect(() => JWTUtils.createTokenSync(unsafeConfig, testUser)).toThrow(
            "config.secret appears to be an asymmetric key.",
        );
    });

    it("Cannot use an asymmetric secret provided as a KeyObject without restricting algorithms.", async () => {
        // e.g. from `crypto.createPrivateKey()`. Neither a string nor a Buffer, so this exercises a distinct
        // detection path from the PEM string/Buffer forms above.
        const unsafeConfig = { secret: crypto.createPrivateKey(rsaPrivateKey) as any };
        await expect(JWTUtils.createToken(unsafeConfig, testUser)).rejects.toThrow(
            "config.secret appears to be an asymmetric key.",
        );
    });

    it("Cannot use an asymmetric secret provided as a { key, passphrase } object without restricting algorithms.", async () => {
        const unsafeConfig = { secret: { key: rsaPrivateKey, passphrase: "" } as any };
        await expect(JWTUtils.createToken(unsafeConfig, testUser)).rejects.toThrow(
            "config.secret appears to be an asymmetric key.",
        );
    });

    it("Does not flag a symmetric KeyObject (e.g. crypto.createSecretKey()) as asymmetric.", async () => {
        const safeConfig = { secret: crypto.createSecretKey(Buffer.from("MyPasswordIsSecure")) as any };
        const token = await JWTUtils.createToken(safeConfig, testUser);
        expect(token).toBeDefined();
    });

    it("Rejects an asymmetric secret whose algorithms list still permits an HMAC algorithm (algorithm confusion).", async () => {
        // A public/private RSA key with `algorithms: ["RS256", "HS256"]` is a classic algorithm-confusion trap:
        // an attacker holding only the public key could forge a token by signing it with HS256 using the
        // public PEM as the HMAC secret. Restricting `algorithms` at all is not sufficient - it must also
        // exclude HMAC algorithms.
        const confusableConfig = { secret: rsaPublicKey, options: { algorithms: ["RS256", "HS256"] as any } };
        await expect(JWTUtils.decodeToken(confusableConfig, "not-a-real-token")).rejects.toThrow(
            "includes an HMAC algorithm",
        );
        expect(() => JWTUtils.decodeTokenSync(confusableConfig, "not-a-real-token")).toThrow(
            "includes an HMAC algorithm",
        );
    });

    it("Allows an asymmetric secret whose algorithms list correctly excludes HMAC algorithms.", async () => {
        // jsonwebtoken's `sign()` rejects the plural `algorithms` key outright (it's a `verify()`-only option),
        // so a token signed with an asymmetric key is produced directly here rather than via
        // JWTUtils.createToken(); this test's focus is JWTUtils.decodeToken()'s assertSafeAlgorithm() call
        // correctly allowing a safe (non-HMAC) `algorithms` restriction through instead of throwing.
        const token = jwt.sign({ profile: JSON.stringify(testUser), sessionUid: "s1" }, rsaPrivateKey, {
            algorithm: "RS256",
        });
        const decodeConfig = { secret: rsaPublicKey, options: { algorithms: ["RS256"] as any } };
        const payload = await JWTUtils.decodeToken(decodeConfig, token);
        expect(payload.profile).toEqual(testUser);
    });

    it("Rejects an unrecognized secret shape (e.g. a GetPublicKeyOrSecret callback) without restricted algorithms.", async () => {
        // A callback-style secret can resolve to anything, including a public key - it must be treated as
        // conservatively unsafe rather than silently allowed through just because it isn't a recognized
        // asymmetric shape.
        const callbackConfig = { secret: ((_header: any, cb: any) => cb(null, "irrelevant")) as any };
        await expect(JWTUtils.createToken(callbackConfig, testUser)).rejects.toThrow(
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
