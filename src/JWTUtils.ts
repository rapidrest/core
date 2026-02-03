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
     * The list of roles (by name) that the user is apart of and will assume privileges for.
     */
    roles: string[];

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
    /**
     * Generates a new JWT token for the given config and user object. The user object must be a valid RapidREST
     * user.
     *
     * @param config The JWT configuration to use when generating the token.
     * @param user The user to encode into the token's payload.
     * @param data Additional data to include the token's payload.
     */
    public static createToken(config: JWTUtilsConfig, user: JWTUser, data?: any): string {
        // Validate the required config options
        if (!config.secret) {
            throw new Error("Invalid configuration provided.");
        }

        // Validate the user object
        if (!user || !user.uid) {
            throw new Error("Invalid or null user object provided.");
        }

        let payload: any = { profile: JSON.stringify(user), ...data };

        // Encrypt the profile if desired
        if (config.payload && config.payload.encrypt) {
            const payloadOptions: any = config.payload;
            if (payloadOptions.private_key) {
                const keyOptions: JWTUtilsPayloadKeyOptions = payloadOptions as JWTUtilsPayloadKeyOptions;
                const encrypted: Buffer = crypto.privateEncrypt(keyOptions.private_key, Buffer.from(payload.profile));
                payload.profile = encrypted.toString("base64");
            } else {
                const pwOtions: JWTUtilsPayloadPasswordOptions = payloadOptions as JWTUtilsPayloadPasswordOptions;
                const iv: Buffer = Buffer.from(pwOtions.iv);
                const key: Buffer = crypto.scryptSync(pwOtions.password, "salt", 24);
                const cipher = crypto.createCipheriv(pwOtions.algorithm, key, iv);

                let encrypted: string = cipher.update(payload.profile, "utf8", "base64");
                encrypted += cipher.final("base64");
                payload.profile = encrypted;
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
    public static decodeToken(config: JWTUtilsConfig, token: string): JWTPayload {
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
                const decrypted: Buffer = crypto.privateDecrypt(keyOptions.private_key, Buffer.from(payload.profile));
                payload.profile = decrypted.toString("utf8");
            } else {
                const pwOtions: JWTUtilsPayloadPasswordOptions = payloadOptions as JWTUtilsPayloadPasswordOptions;
                const iv: Buffer = Buffer.from(payloadOptions.iv);
                const key: Buffer = crypto.scryptSync(payloadOptions.password as string, "salt", 24);
                const decipher = crypto.createDecipheriv(payloadOptions.algorithm, key, iv);

                let decrypted: string = decipher.update(payload.profile, "base64", "utf8");
                decrypted += decipher.final("utf8");
                payload.profile = decrypted;
            }
        }

        // Make sure the profile is an parsed
        payload.profile = JSON.parse(payload.profile);

        return payload;
    }
}
