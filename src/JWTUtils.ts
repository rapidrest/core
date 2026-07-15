///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import crypto from "crypto";
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
     * The unique name of the user.
     */
    name: string;

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
    private static _parsedKeyCache = new Map();

    /**
     * Throws if `config.secret` looks like an asymmetric (RSA/EC) key but `config.options.algorithms` was not
     * explicitly restricted. Signing/verifying with an asymmetric key while leaving `algorithms` unset opens the
     * door to algorithm-confusion attacks (e.g. an attacker forging an HS256 token using the public key as the
     * HMAC secret). HMAC secrets (plain strings/buffers that aren't PEM-encoded) are unaffected.
     *
     * @param config The JWT configuration to validate.
     */
    private static assertSafeAlgorithm(config: JWTUtilsConfig): void {
        const secret = config.secret;
        const looksAsymmetric =
            typeof secret === "string" && /-----BEGIN [A-Z ]*(PRIVATE|PUBLIC) KEY-----/.test(secret);
        if (looksAsymmetric && (!config.options?.algorithms || config.options.algorithms.length === 0)) {
            throw new Error(
                "config.secret appears to be an asymmetric key. config.options.algorithms must be explicitly set " +
                    "(e.g. ['RS256']) to prevent algorithm-confusion attacks.",
            );
        }
    }

    /**
     * Generates a new JWT token for the given config and user object. The user object must be a valid RapidREST
     * user.
     *
     * @param config The JWT configuration to use when generating the token.
     * @param user The user to encode into the token's payload.
     */
    private static deriveKey(password: string, salt: Buffer): Promise<Buffer> {
        return new Promise((resolve, reject) =>
            crypto.scrypt(password, salt, 24, (err, key) => (err ? reject(err) : resolve(key))),
        );
    }

    /**
     * Generates a new JWT token for the given config and user object. The user object must be a valid RapidREST
     * user.
     *
     * @param config The JWT configuration to use when generating the token.
     * @param user The user to encode into the token's payload.
     */
    private static deriveKeySync(password: string, salt: Buffer): Buffer {
        return crypto.scryptSync(password, salt, 24);
    }

    public static async createToken(config: JWTUtilsConfig, user: JWTUser, data?: any): Promise<string> {
        // Validate the required config options
        if (!config.secret) {
            throw new Error("Invalid configuration provided.");
        }

        // Validate the user object
        if (!user || !user.uid) {
            throw new Error("Invalid or null user object provided.");
        }

        // `data` is spread before `profile` so that a `profile` key present in caller-supplied `data` can never
        // silently override the authoritative, server-derived user profile before signing.
        let payload: any = { ...data, profile: JSON.stringify(user) };

        // Encrypt the profile if desired
        if (config.payload && config.payload.encrypt) {
            const payloadOptions: any = config.payload;
            if (payloadOptions.public_key) {
                const keyOptions: JWTUtilsPayloadKeyOptions = payloadOptions as JWTUtilsPayloadKeyOptions;
                const encrypted: Buffer = crypto.publicEncrypt(keyOptions.public_key, Buffer.from(payload.profile));
                payload.profile = encrypted.toString("base64");
            } else {
                const pwOtions: JWTUtilsPayloadPasswordOptions = payloadOptions as JWTUtilsPayloadPasswordOptions;
                const iv: Buffer = Buffer.from(pwOtions.iv);
                const salt = crypto.randomBytes(16);
                const key: Buffer = await JWTUtils.deriveKey(pwOtions.password, salt);
                const cipher = crypto.createCipheriv(pwOtions.algorithm, key, iv);

                let encrypted: string = cipher.update(payload.profile, "utf8", "base64");
                encrypted += cipher.final("base64");
                payload.profile = salt.toString("base64") + ":" + encrypted;
            }
            payload.encryption = true;
        }

        // Compress the profile if desired
        if (config.payload && config.payload.compress) {
            if (config.payload.compress === JWTUtilsCompressionMethods.ZLIB) {
                const buf: Buffer = Buffer.from(payload.profile, "utf-8");
                payload.profile = zlib.gzipSync(buf).toString("base64");
                payload.compression = "zlib";
            }
        }

        JWTUtils.assertSafeAlgorithm(config);
        return jwt.sign(payload, config.secret, config.options as jwt.SignOptions | undefined);
    }

    public static createTokenSync(config: JWTUtilsConfig, user: JWTUser, data?: any): string {
        // Validate the required config options
        if (!config.secret) {
            throw new Error("Invalid configuration provided.");
        }

        // Validate the user object
        if (!user || !user.uid) {
            throw new Error("Invalid or null user object provided.");
        }

        // `data` is spread before `profile` so that a `profile` key present in caller-supplied `data` can never
        // silently override the authoritative, server-derived user profile before signing.
        let payload: any = { ...data, profile: JSON.stringify(user) };

        // Encrypt the profile if desired
        if (config.payload && config.payload.encrypt) {
            const payloadOptions: any = config.payload;
            if (payloadOptions.public_key) {
                const keyOptions: JWTUtilsPayloadKeyOptions = payloadOptions as JWTUtilsPayloadKeyOptions;
                const encrypted: Buffer = crypto.publicEncrypt(keyOptions.public_key, Buffer.from(payload.profile));
                payload.profile = encrypted.toString("base64");
            } else {
                const pwOtions: JWTUtilsPayloadPasswordOptions = payloadOptions as JWTUtilsPayloadPasswordOptions;
                const iv: Buffer = Buffer.from(pwOtions.iv);
                const salt = crypto.randomBytes(16);
                const key: Buffer = JWTUtils.deriveKeySync(pwOtions.password, salt);
                const cipher = crypto.createCipheriv(pwOtions.algorithm, key, iv);

                let encrypted: string = cipher.update(payload.profile, "utf8", "base64");
                encrypted += cipher.final("base64");
                payload.profile = salt.toString("base64") + ":" + encrypted;
            }
            payload.encryption = true;
        }

        // Compress the profile if desired
        if (config.payload && config.payload.compress) {
            if (config.payload.compress === JWTUtilsCompressionMethods.ZLIB) {
                const buf: Buffer = Buffer.from(payload.profile, "utf-8");
                payload.profile = zlib.gzipSync(buf).toString("base64");
                payload.compression = "zlib";
            }
        }

        JWTUtils.assertSafeAlgorithm(config);
        return jwt.sign(payload, config.secret, config.options as jwt.SignOptions | undefined);
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
        JWTUtils.assertSafeAlgorithm(config);
        // Decode the token
        let payload: any = jwt.verify(token, config.secret, config.options);

        // Validate the payload
        if (!payload || !payload.profile) {
            throw new Error("Token is invalid or missing data.");
        }

        // Decompress the payload if desired
        if (payload.compression === JWTUtilsCompressionMethods.ZLIB) {
            const buf: Buffer = Buffer.from(payload.profile as string, "base64");
            payload.profile = zlib.gunzipSync(buf).toString("utf-8");
        }

        // Decrypt the payload if desired
        if (payload.encryption && config.payload && config.payload.encrypt) {
            const payloadOptions: any = config.payload;
            if (payloadOptions.private_key) {
                const keyOptions: JWTUtilsPayloadKeyOptions = payloadOptions as JWTUtilsPayloadKeyOptions;
                const decrypted: Buffer = crypto.privateDecrypt(keyOptions.private_key, Buffer.from(payload.profile, "base64"));
                payload.profile = decrypted.toString("utf8");
            } else {
                const pwOtions: JWTUtilsPayloadPasswordOptions = payloadOptions as JWTUtilsPayloadPasswordOptions;
                const iv: Buffer = Buffer.from(pwOtions.iv);
                const [saltB64, profile] = payload.profile.split(":");
                const salt = Buffer.from(saltB64, "base64");
                const key: Buffer = await JWTUtils.deriveKey(pwOtions.password, salt);
                const decipher = crypto.createDecipheriv(pwOtions.algorithm, key, iv);

                let decrypted: string = decipher.update(profile, "base64", "utf8");
                decrypted += decipher.final("utf8");
                payload.profile = decrypted;
            }
        }

        // Make sure the profile is an parsed
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
    public static decodeTokenSync(config: JWTUtilsConfig, token: string): JWTPayload {
        JWTUtils.assertSafeAlgorithm(config);
        // Decode the token
        let payload: any = jwt.verify(token, config.secret, config.options);

        // Validate the payload
        if (!payload || !payload.profile) {
            throw new Error("Token is invalid or missing data.");
        }

        // Decompress the payload if desired
        if (payload.compression === JWTUtilsCompressionMethods.ZLIB) {
            const buf: Buffer = Buffer.from(payload.profile as string, "base64");
            payload.profile = zlib.gunzipSync(buf).toString("utf-8");
        }

        // Decrypt the payload if desired
        if (payload.encryption && config.payload && config.payload.encrypt) {
            const payloadOptions: any = config.payload;
            if (payloadOptions.private_key) {
                const keyOptions: JWTUtilsPayloadKeyOptions = payloadOptions as JWTUtilsPayloadKeyOptions;
                const decrypted: Buffer = crypto.privateDecrypt(keyOptions.private_key, Buffer.from(payload.profile, "base64"));
                payload.profile = decrypted.toString("utf8");
            } else {
                const pwOtions: JWTUtilsPayloadPasswordOptions = payloadOptions as JWTUtilsPayloadPasswordOptions;
                const iv: Buffer = Buffer.from(pwOtions.iv);
                const [saltB64, profile] = payload.profile.split(":");
                const salt = Buffer.from(saltB64, "base64");
                const key: Buffer = JWTUtils.deriveKeySync(pwOtions.password, salt);
                const decipher = crypto.createDecipheriv(pwOtions.algorithm, key, iv);

                let decrypted: string = decipher.update(profile, "base64", "utf8");
                decrypted += decipher.final("utf8");
                payload.profile = decrypted;
            }
        }

        // Make sure the profile is an parsed
        payload.profile = JSON.parse(payload.profile);

        return payload;
    }
}
