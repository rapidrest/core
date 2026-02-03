[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / JWTUtilsConfig

# Interface: JWTUtilsConfig

Defined in: src/JWTUtils.ts:123

Describes the configuration options to be used with `JWTUtils` functions.

## Author

Jean-Philippe Steinmetz <rapidrests@gmail.com>

## Properties

### options?

> `optional` **options**: `VerifyOptions`

Defined in: src/JWTUtils.ts:132

The options to use when performing JWT signing or verification.

***

### payload?

> `optional` **payload**: [`JWTUtilsPayloadOptions`](JWTUtilsPayloadOptions.md) \| [`JWTUtilsPayloadPasswordOptions`](JWTUtilsPayloadPasswordOptions.md) \| [`JWTUtilsPayloadKeyOptions`](JWTUtilsPayloadKeyOptions.md)

Defined in: src/JWTUtils.ts:137

The options that determine how JWT token payloads will be handled.

***

### secret

> **secret**: `Secret`

Defined in: src/JWTUtils.ts:127

The secret to use for signing and verifying JWT tokens.
