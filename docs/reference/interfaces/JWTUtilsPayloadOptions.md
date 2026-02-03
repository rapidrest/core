[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / JWTUtilsPayloadOptions

# Interface: JWTUtilsPayloadOptions

Defined in: src/JWTUtils.ts:65

Describes the configuration options to be used with the `JWTUtilsConfig.payload` property.

## Author

Jean-Philippe Steinmetz <rapidrests@gmail.com>

## Extended by

- [`JWTUtilsPayloadPasswordOptions`](JWTUtilsPayloadPasswordOptions.md)
- [`JWTUtilsPayloadKeyOptions`](JWTUtilsPayloadKeyOptions.md)

## Properties

### compress?

> `optional` **compress**: [`ZLIB`](../enumerations/JWTUtilsCompressionMethods.md#zlib)

Defined in: src/JWTUtils.ts:69

Set the method to use for compressing the payload profile, otherwise set to `null` for no compression.

***

### encrypt?

> `optional` **encrypt**: `boolean`

Defined in: src/JWTUtils.ts:74

Set to `true` to indicate that the JWT token payload is encrypted, otherwise set to `false`.
