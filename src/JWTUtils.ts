///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
// SPDX-License-Identifier: MPL-2.0
///////////////////////////////////////////////////////////////////////////////
import crypto, { KeyObject } from "crypto";
import jwt from "jsonwebtoken";
import zlib from "zlib";

/**
 * Describes user data that is encoded in the payload of a JWT token.
 *
 * @author Jean-Philippe Steinmetz <rapidrests@gmail.com>
 */
export interface JWTUser {
    /**
     * The universally unique identifier of the user.
     */
    uid: string;

    /**
     * The timestamp that the user was granted elevated privileges. A negative value indicates the user is unprivileged. Default value is `-1`.
     */
    elevated?: number;

    /**
     * The list of roles (by name) that the user is a member of and will inherit the permissions of.
     */
    roles: string[];

    /**
     * The list of auth scopes that the user has been granted permission for.
     */
    scopes: string[];

    /**
     * Indicates if the user's e-mail address has been verified.
     */
    verified?: boolean;
}

/**
 * Describes the payload data structure of signed JWT tokens.
 */
export interface JWTPayload extends jwt.JwtPayload {
    /** Indicates if the payload profile has been compressed and with what method. */
    compression?: "zlib";

    /** Indicates if the payload profile has been encrypted. */
    encryption?: boolean;

    /** The user profile of the authenticated user the token is valid for. */
    profile: JWTUser | string;

    /** The unique identifier of the user's authentication session. */
    sessionUid: string;
}

/**
 * Describes the different types of support compression methods for JWT payloads.
 */
export enum JWTUtilsCompressionMethods {
    /** Uses the zlib compression method. */
    ZLIB = "zlib"
}

/**
 * Describes the configuration options to be used with the `JWTUtilsConfig.payload` property.
 *
 * @author Jean-Philippe Steinmetz <rapidrests@gmail.com>
 */
export interface JWTUtilsPayloadOptions {
    /**
     * Set the method to use for compressing the payload profile, otherwise set to `null` for no compression.
     */
    compress?: JWTUtilsCompressionMethods;

    /**
     * Set to `true` to indicate that the JWT token payload is encrypted, otherwise set to `false`.
     */
    encrypt?: boolean;
}

/**
 * Describes the configuration options to be used with the `JWTUtilsConfig.payload` property when performing password
 * based encryption.
 *
 * @author Jean-Philippe Steinmetz <rapidrests@gmail.com>
 */
export interface JWTUtilsPayloadPasswordOptions extends JWTUtilsPayloadOptions {
    /**
     * The cryptographic cipher algorithm to use during encryption/decryption of a JWT token payload.
     */
    algorithm: string;

    /**
     * The initialization vector to use during encryption and decryption.
     */
    iv: Buffer;

    /**
     * The password to use when encrypting or decrypting JWT token payloads.
     */
    password: string;
}

/**
 * Describes the configuration options to be used with the `JWTUtilsConfig.payload` property when performing
 * key-based encryption.
 *
 * @author Jean-Philippe Steinmetz <rapidrests@gmail.com>
 */
export interface JWTUtilsPayloadKeyOptions extends JWTUtilsPayloadOptions {
    /**
     * The private key used to encrypt JWT token payloads.
     */
    private_key: string;

    /**
     * The public key used to decrypt JWT token payloads.
     */
    public_key: string;
}

/**
 * Describes the configuration options to be used with `JWTUtils` functions.
 *
 * @author Jean-Philippe Steinmetz <rapidrests@gmail.com>
 */
export interface JWTUtilsConfig {
    /**
     * The secret to use for signing and verifying JWT tokens.
     */
    secret: jwt.Secret;

    /**
     * The options to use when performing JWT signing or verification.
     */
    options?: jwt.VerifyOptions;

    /**
     * The options that determine how JWT token payloads will be handled.
     */
    payload?: JWTUtilsPayloadOptions | JWTUtilsPayloadKeyOptions | JWTUtilsPayloadPasswordOptions;
}

/**
 * Utility class for working with Json Web Token (JWT) authentication tokens.
 *
 * @author Jean-Philippe Steinmetz <rapidrests@gmail.com>
 */
export class JWTUtils {
    /** HMAC algorithm names that must never be permitted alongside a non-HMAC secret (see `assertSafeAlgorithm`). */
    private static readonly HMAC_ALGORITHMS = new Set(["HS256", "HS384", "HS512"]);
    /** Maximum size, in bytes, a compressed profile is allowed to decompress to (see `finalizePayload`). Guards
     * against a decompression bomb - a small compressed payload expanding to consume excessive memory. */
    private static readonly MAX_DECOMPRESSED_PROFILE_BYTES = 10 * 1024 * 1024;

    /**
     * Returns `true` if `secret` is a form that is only ever usable as a genuine HMAC secret - a plain
     * string/Buffer that isn't PEM-encoded, or a `KeyObject` of type `"secret"`. Anything else (a PEM
     * string/Buffer, an asymmetric `KeyObject`, a `{ key, passphrase }` wrapper, a `GetPublicKeyOrSecret`
     * callback, a JWK-shaped object, etc.) is *not* considered safe, since it may resolve to a non-secret
     * (public) value that an attacker could use to forge an HS256/384/512 token.
     */
    private static isKnownSafeHmacSecret(secret: any): boolean {
        const pemPattern = /-----BEGIN [A-Z ]*(PRIVATE|PUBLIC) KEY-----/;
        if (typeof secret === "string") {
            return !pemPattern.test(secret);
        }
        // `fs.readFileSync()` - the idiomatic way to load a key file - returns a Buffer, not a string, so both
        // representations must be checked here.
        if (Buffer.isBuffer(secret)) {
            return !pemPattern.test(secret.toString("utf8"));
        }
        if (secret instanceof KeyObject) {
            return secret.type === "secret";
        }
        return false;
    }

    /**
     * Throws unless `config.secret` is a known-safe plain HMAC secret. Any other secret shape is treated
     * conservatively as potentially asymmetric (fail closed, rather than only matching a fixed allowlist of
     * asymmetric shapes seen so far) and requires `config.options.algorithms` to be explicitly set to a list
     * that does not itself include an HMAC algorithm. Without this, signing/verifying with e.g. an RSA key
     * while leaving `algorithms` unset - or restricting it to `["RS256", "HS256"]` - opens the door to
     * algorithm-confusion attacks: an attacker holding only the public half of the key pair can forge a token
     * by signing it with HS256 using that public value as the HMAC secret.
     *
     * @param config The JWT configuration to validate.
     */
    private static assertSafeAlgorithm(config: JWTUtilsConfig): void {
        const secret: any = config.secret;
        if (JWTUtils.isKnownSafeHmacSecret(secret)) {
            return;
        }

        const algorithms = config.options?.algorithms;
        if (!algorithms || algorithms.length === 0) {
            throw new Error(
                "config.secret appears to be an asymmetric key. config.options.algorithms must be explicitly set " +
                    "(e.g. ['RS256']) to prevent algorithm-confusion attacks.",
            );
        }
        if (algorithms.some((alg) => JWTUtils.HMAC_ALGORITHMS.has(alg))) {
            throw new Error(
                "config.options.algorithms includes an HMAC algorithm (HS256/HS384/HS512) alongside a " +
                    "non-HMAC secret. This would allow an attacker holding the public half of the key to forge " +
                    "tokens via algorithm confusion. Remove HMAC algorithms from config.options.algorithms.",
            );
        }
    }

    /**
     * Returns the key length, in bytes, required by `algorithm` (e.g. 32 for `aes-256-cbc`, 24 for
     * `aes-192-cbc`), so the scrypt-derived key `deriveKey`/`deriveKeySync` produce always matches whatever
     * cipher `passwordOptions.algorithm` actually names, instead of a length hard-coded for one specific
     * algorithm. Throws a clear error for an algorithm Node's `crypto` module doesn't recognize, rather than
     * letting `createCipheriv`/`createDecipheriv` fail later with an opaque "Invalid key length".
     */
    private static resolveKeyLength(algorithm: string): number {
        const info = crypto.getCipherInfo(algorithm);
        if (!info?.keyLength) {
            throw new Error(`Unknown or unsupported cipher algorithm: "${algorithm}".`);
        }
        return info.keyLength;
    }

    /**
     * Derives a symmetric encryption key from `password`/`salt` for use with `algorithm`.
     */
    private static deriveKey(password: string, salt: Buffer, algorithm: string): Promise<Buffer> {
        const keyLength = JWTUtils.resolveKeyLength(algorithm);
        return new Promise((resolve, reject) =>
            crypto.scrypt(password, salt, keyLength, (err, key) => (err ? reject(err) : resolve(key))),
        );
    }

    /**
     * Synchronous counterpart to `deriveKey()`. **Blocks the event loop** for the duration of the scrypt
     * derivation (deliberately CPU-expensive, typically tens of milliseconds) - `createTokenSync`/
     * `decodeTokenSync` should therefore be avoided on a request-handling path when password-based payload
     * encryption is configured; prefer `createToken`/`decodeToken` there.
     */
    private static deriveKeySync(password: string, salt: Buffer, algorithm: string): Buffer {
        return crypto.scryptSync(password, salt, JWTUtils.resolveKeyLength(algorithm));
    }

    /**
     * Encrypts `plaintext` for `publicKey` using hybrid encryption: `plaintext` is encrypted with a fresh
     * AES-256-GCM key, which is itself wrapped with RSA. This avoids `crypto.publicEncrypt`'s fixed plaintext-size
     * limit (e.g. ~214 bytes for a 2048-bit key with OAEP padding), which a raw JSON user profile easily exceeds.
     *
     * @param publicKey The RSA public key to wrap the AES key with.
     * @param plaintext The data to encrypt.
     * @returns The encrypted data, encoded as `<wrapped-key>.<iv>.<authTag>.<ciphertext>`, all base64.
     */
    private static hybridEncrypt(publicKey: string, plaintext: string): string {
        const aesKey: Buffer = crypto.randomBytes(32);
        const iv: Buffer = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
        let ciphertext: string = cipher.update(plaintext, "utf8", "base64");
        ciphertext += cipher.final("base64");
        const authTag: Buffer = cipher.getAuthTag();
        const wrappedKey: Buffer = crypto.publicEncrypt(publicKey, aesKey);
        return [wrappedKey.toString("base64"), iv.toString("base64"), authTag.toString("base64"), ciphertext].join(
            ".",
        );
    }

    /**
     * Returns the base64-encoded authentication tag for `cipher` if it's an AEAD cipher, otherwise `""`. Rather
     * than pattern-matching the algorithm name (which only recognizes a fixed list of known AEAD naming
     * conventions), this asks the cipher itself via `getAuthTag()`, which throws for any non-AEAD cipher - so
     * any AEAD cipher/alias supported by the current Node/OpenSSL build is handled correctly, including ones
     * not known when this was last updated.
     */
    private static getAuthTagIfAEAD(cipher: crypto.CipherCCM | crypto.CipherGCM | crypto.CipherOCB): string {
        try {
            return cipher.getAuthTag().toString("base64");
        } catch {
            return "";
        }
    }

    /**
     * Decrypts data produced by `hybridEncrypt`.
     *
     * @param privateKey The RSA private key to unwrap the AES key with.
     * @param encoded The encrypted data, as produced by `hybridEncrypt`.
     */
    private static hybridDecrypt(privateKey: string, encoded: string): string {
        const parts = encoded.split(".");
        // Mirrors the length check `finishPasswordDecryption`'s caller performs for the password-based format:
        // without it, a malformed `profile` (e.g. from an outdated/different format) throws an untyped
        // `TypeError` out of `Buffer.from(undefined, ...)` below instead of a clear, identifiable error.
        if (parts.length !== 4) {
            throw new Error("Encrypted profile uses an unrecognized or outdated format and cannot be decoded.");
        }
        const [wrappedKeyB64, ivB64, authTagB64, ciphertext] = parts;
        const aesKey: Buffer = crypto.privateDecrypt(privateKey, Buffer.from(wrappedKeyB64, "base64"));
        const iv: Buffer = Buffer.from(ivB64, "base64");
        const authTag: Buffer = Buffer.from(authTagB64, "base64");
        const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey, iv);
        decipher.setAuthTag(authTag);
        let decrypted: string = decipher.update(ciphertext, "base64", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
    }

    /**
     * Builds the signable payload shared by `createToken`/`createTokenSync`: validates `config`/`user`, spreads
     * `data`, compresses the profile if requested, and - for public-key encryption only, which has no async
     * dependency - encrypts it. Password-based encryption is left for the caller to finish via
     * `finishPasswordEncryption()`, since deriving the key is the one step that differs between the sync and
     * async entry points.
     */
    private static preparePayload(
        config: JWTUtilsConfig,
        user: JWTUser,
        data?: any,
    ): { payload: any; passwordOptions?: JWTUtilsPayloadPasswordOptions } {
        if (!config.secret) {
            throw new Error("Invalid configuration provided.");
        }
        if (!user || !user.uid) {
            throw new Error("Invalid or null user object provided.");
        }

        // `data` is spread before `profile` so that a `profile` key present in caller-supplied `data` can never
        // silently override the authoritative, server-derived user profile before signing.
        const payload: any = { ...data, profile: JSON.stringify(user) };

        // Compress the profile if desired. Done *before* encryption so encryption (and, for RSA, its fixed
        // plaintext-size limit) operates on the smaller compressed representation rather than the raw JSON.
        if (config.payload && config.payload.compress) {
            if (config.payload.compress === JWTUtilsCompressionMethods.ZLIB) {
                const buf: Buffer = Buffer.from(payload.profile, "utf-8");
                payload.profile = zlib.gzipSync(buf).toString("base64");
                payload.compression = "zlib";
            }
        }

        let passwordOptions: JWTUtilsPayloadPasswordOptions | undefined;
        if (config.payload && config.payload.encrypt) {
            const payloadOptions: any = config.payload;
            if (payloadOptions.public_key) {
                const keyOptions: JWTUtilsPayloadKeyOptions = payloadOptions as JWTUtilsPayloadKeyOptions;
                payload.profile = JWTUtils.hybridEncrypt(keyOptions.public_key, payload.profile);
                payload.encryption = true;
            } else {
                passwordOptions = payloadOptions as JWTUtilsPayloadPasswordOptions;
            }
        }

        return { payload, passwordOptions };
    }

    /** Finishes password-based payload encryption once `key` has been derived (sync or async). */
    private static finishPasswordEncryption(
        payload: any,
        passwordOptions: JWTUtilsPayloadPasswordOptions,
        key: Buffer,
        salt: Buffer,
    ): void {
        const iv: Buffer = Buffer.from(passwordOptions.iv);
        const cipher = crypto.createCipheriv(passwordOptions.algorithm, key, iv);

        let encrypted: string = cipher.update(payload.profile, "utf8", "base64");
        encrypted += cipher.final("base64");
        // AEAD ciphers (e.g. aes-256-gcm) require the auth tag to be captured here and verified on decrypt via
        // setAuthTag(), otherwise decoding throws "Unsupported state or unable to authenticate data" on every
        // token. `final()` must be called before `getAuthTag()` - the tag isn't available until encryption
        // has finished.
        const authTag: string = JWTUtils.getAuthTagIfAEAD(cipher as crypto.CipherGCM);
        payload.profile = salt.toString("base64") + ":" + authTag + ":" + encrypted;
        payload.encryption = true;
    }

    public static async createToken(config: JWTUtilsConfig, user: JWTUser, data?: any): Promise<string> {
        const { payload, passwordOptions } = JWTUtils.preparePayload(config, user, data);
        if (passwordOptions) {
            const salt = crypto.randomBytes(16);
            const key: Buffer = await JWTUtils.deriveKey(passwordOptions.password, salt, passwordOptions.algorithm);
            JWTUtils.finishPasswordEncryption(payload, passwordOptions, key, salt);
        }

        JWTUtils.assertSafeAlgorithm(config);
        return jwt.sign(payload, config.secret, config.options as jwt.SignOptions | undefined);
    }

    /**
     * Synchronous counterpart to `createToken()`. **Blocks the event loop** while deriving the encryption key
     * when password-based payload encryption is configured (see `deriveKeySync`) - prefer `createToken()` on a
     * request-handling path in that case.
     */
    public static createTokenSync(config: JWTUtilsConfig, user: JWTUser, data?: any): string {
        const { payload, passwordOptions } = JWTUtils.preparePayload(config, user, data);
        if (passwordOptions) {
            const salt = crypto.randomBytes(16);
            const key: Buffer = JWTUtils.deriveKeySync(passwordOptions.password, salt, passwordOptions.algorithm);
            JWTUtils.finishPasswordEncryption(payload, passwordOptions, key, salt);
        }

        JWTUtils.assertSafeAlgorithm(config);
        return jwt.sign(payload, config.secret, config.options as jwt.SignOptions | undefined);
    }

    /**
     * Verifies `token` and prepares its payload for `decodeToken`/`decodeTokenSync`: validates the signature/
     * shape, and - for private-key decryption only, which has no async dependency - decrypts it in place.
     * Password-based decryption is left for the caller to finish via `finishPasswordDecryption()`, since
     * deriving the key is the one step that differs between the sync and async entry points.
     */
    private static preDecode(
        config: JWTUtilsConfig,
        token: string,
    ): {
        payload: any;
        passwordOptions?: JWTUtilsPayloadPasswordOptions;
        salt?: Buffer;
        authTagB64?: string;
        encryptedProfile?: string;
    } {
        JWTUtils.assertSafeAlgorithm(config);
        const payload: any = jwt.verify(token, config.secret, config.options);

        if (!payload || !payload.profile) {
            throw new Error("Token is invalid or missing data.");
        }

        let passwordOptions: JWTUtilsPayloadPasswordOptions | undefined;
        let salt: Buffer | undefined;
        let authTagB64: string | undefined;
        let encryptedProfile: string | undefined;

        // Decrypt the payload if desired. Must happen before decompression since compression is applied *before*
        // encryption when the token is created, so decryption must be undone first.
        if (payload.encryption && config.payload && config.payload.encrypt) {
            const payloadOptions: any = config.payload;
            if (payloadOptions.private_key) {
                const keyOptions: JWTUtilsPayloadKeyOptions = payloadOptions as JWTUtilsPayloadKeyOptions;
                payload.profile = JWTUtils.hybridDecrypt(keyOptions.private_key, payload.profile);
            } else {
                passwordOptions = payloadOptions as JWTUtilsPayloadPasswordOptions;
                const parts: string[] = payload.profile.split(":");
                // The current format is `<salt>:<authTag>:<ciphertext>` (3 parts). A 2-part `<salt>:<ciphertext>`
                // payload is the pre-AEAD-auth-tag format from before this method required an auth tag; without
                // this check, `encryptedProfile` would silently come back `undefined` and decryption would be
                // skipped, surfacing as an opaque JSON.parse SyntaxError in finalizePayload() instead of a clear
                // error identifying the actual problem.
                if (parts.length !== 3) {
                    throw new Error(
                        "Token payload uses an unrecognized or outdated encrypted format and cannot be decoded.",
                    );
                }
                const [saltB64, tagB64, profile] = parts;
                salt = Buffer.from(saltB64, "base64");
                authTagB64 = tagB64;
                encryptedProfile = profile;
            }
        }

        return { payload, passwordOptions, salt, authTagB64, encryptedProfile };
    }

    /** Finishes password-based payload decryption once `key` has been derived (sync or async). */
    private static finishPasswordDecryption(
        payload: any,
        passwordOptions: JWTUtilsPayloadPasswordOptions,
        key: Buffer,
        encryptedProfile: string,
        authTagB64: string | undefined,
    ): void {
        const iv: Buffer = Buffer.from(passwordOptions.iv);
        const decipher = crypto.createDecipheriv(passwordOptions.algorithm, key, iv);
        if (authTagB64) {
            (decipher as crypto.DecipherGCM).setAuthTag(Buffer.from(authTagB64, "base64"));
        }

        let decrypted: string = decipher.update(encryptedProfile, "base64", "utf8");
        decrypted += decipher.final("utf8");
        payload.profile = decrypted;
    }

    /** Decompresses (if applicable) and parses the final payload profile shared by both decode entry points. */
    private static finalizePayload(payload: any): JWTPayload {
        if (payload.compression === JWTUtilsCompressionMethods.ZLIB) {
            const buf: Buffer = Buffer.from(payload.profile as string, "base64");
            // Cap decompressed size against a decompression bomb (a small compressed payload expanding to consume
            // excessive memory). Requires a validly-signed token, but costs nothing to bound given every other
            // cache/store in this codebase is similarly size-limited.
            payload.profile = zlib
                .gunzipSync(buf, { maxOutputLength: JWTUtils.MAX_DECOMPRESSED_PROFILE_BYTES })
                .toString("utf-8");
        }
        payload.profile = JSON.parse(payload.profile);
        return payload;
    }

    /**
     * Decodes the given JWT authentication token using the provided configuration. If the token is not valid an
     * error is thrown with the reason. Returns the encoded user object payload upon success.
     *
     * @param config The JWT configuration to use when validating the token.
     * @param token The JWT token to validate.
     * @returns The data encoded in the token's payload.
     */
    public static async decodeToken(config: JWTUtilsConfig, token: string): Promise<JWTPayload> {
        const { payload, passwordOptions, salt, authTagB64, encryptedProfile } = JWTUtils.preDecode(config, token);
        if (passwordOptions && salt && encryptedProfile !== undefined) {
            const key: Buffer = await JWTUtils.deriveKey(passwordOptions.password, salt, passwordOptions.algorithm);
            JWTUtils.finishPasswordDecryption(payload, passwordOptions, key, encryptedProfile, authTagB64);
        }
        return JWTUtils.finalizePayload(payload);
    }

    /**
     * Synchronous counterpart to `decodeToken()`. **Blocks the event loop** while deriving the decryption key
     * when password-based payload encryption is configured (see `deriveKeySync`) - prefer `decodeToken()` on a
     * request-handling path in that case.
     *
     * @param config The JWT configuration to use when validating the token.
     * @param token The JWT token to validate.
     * @returns The data encoded in the token's payload.
     */
    public static decodeTokenSync(config: JWTUtilsConfig, token: string): JWTPayload {
        const { payload, passwordOptions, salt, authTagB64, encryptedProfile } = JWTUtils.preDecode(config, token);
        if (passwordOptions && salt && encryptedProfile !== undefined) {
            const key: Buffer = JWTUtils.deriveKeySync(passwordOptions.password, salt, passwordOptions.algorithm);
            JWTUtils.finishPasswordDecryption(payload, passwordOptions, key, encryptedProfile, authTagB64);
        }
        return JWTUtils.finalizePayload(payload);
    }
}
