[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / JWTUtilsPayloadPasswordOptions

# Interface: JWTUtilsPayloadPasswordOptions

Defined in: src/JWTUtils.ts:83

Describes the configuration options to be used with the `JWTUtilsConfig.payload` property when performing password
based encryption.

## Author

Jean-Philippe Steinmetz <rapidrests@gmail.com>

## Extends

- [`JWTUtilsPayloadOptions`](JWTUtilsPayloadOptions.md)

## Properties

### algorithm

> **algorithm**: `string`

Defined in: src/JWTUtils.ts:87

The cryptographic cipher algorithm to use during encryption/decryption of a JWT token payload.

***

### compress?

> `optional` **compress**: [`ZLIB`](../enumerations/JWTUtilsCompressionMethods.md#zlib)

Defined in: src/JWTUtils.ts:69

Set the method to use for compressing the payload profile, otherwise set to `null` for no compression.

#### Inherited from

[`JWTUtilsPayloadOptions`](JWTUtilsPayloadOptions.md).[`compress`](JWTUtilsPayloadOptions.md#compress)

***

### encrypt?

> `optional` **encrypt**: `boolean`

Defined in: src/JWTUtils.ts:74

Set to `true` to indicate that the JWT token payload is encrypted, otherwise set to `false`.

#### Inherited from

[`JWTUtilsPayloadOptions`](JWTUtilsPayloadOptions.md).[`encrypt`](JWTUtilsPayloadOptions.md#encrypt)

***

### iv

> **iv**: `Buffer`

Defined in: src/JWTUtils.ts:92

The initialization vector to use during encryption and decryption.

***

### password

> **password**: `string`

Defined in: src/JWTUtils.ts:97

The password to use when encrypting or decrypting JWT token payloads.
