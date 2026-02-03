[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / JWTUtilsPayloadKeyOptions

# Interface: JWTUtilsPayloadKeyOptions

Defined in: src/JWTUtils.ts:106

Describes the configuration options to be used with the `JWTUtilsConfig.payload` property when performing
key-based encryption.

## Author

Jean-Philippe Steinmetz <rapidrests@gmail.com>

## Extends

- [`JWTUtilsPayloadOptions`](JWTUtilsPayloadOptions.md)

## Properties

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

### private\_key

> **private\_key**: `string`

Defined in: src/JWTUtils.ts:110

The private key used to encrypt JWT token payloads.

***

### public\_key

> **public\_key**: `string`

Defined in: src/JWTUtils.ts:115

The public key used to decrypt JWT token payloads.
