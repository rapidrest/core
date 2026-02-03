[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / JWTUtils

# Class: JWTUtils

Defined in: src/JWTUtils.ts:145

Utility class for working with Json Web Token (JWT) authentication tokens.

## Author

Jean-Philippe Steinmetz <rapidrests@gmail.com>

## Constructors

### Constructor

> **new JWTUtils**(): `JWTUtils`

#### Returns

`JWTUtils`

## Methods

### createToken()

> `static` **createToken**(`config`, `user`, `data?`): `string`

Defined in: src/JWTUtils.ts:154

Generates a new JWT token for the given config and user object. The user object must be a valid RapidREST
user.

#### Parameters

##### config

[`JWTUtilsConfig`](../interfaces/JWTUtilsConfig.md)

The JWT configuration to use when generating the token.

##### user

[`JWTUser`](../interfaces/JWTUser.md)

The user to encode into the token's payload.

##### data?

`any`

Additional data to include the token's payload.

#### Returns

`string`

***

### decodeToken()

> `static` **decodeToken**(`config`, `token`): [`JWTPayload`](../interfaces/JWTPayload.md)

Defined in: src/JWTUtils.ts:207

Decodes the given JWT authentication token using the provided configuration. If the token is not valid an
error is thrown with the reason. Returns the encoded user object payload upon success.

#### Parameters

##### config

[`JWTUtilsConfig`](../interfaces/JWTUtilsConfig.md)

The JWT configuration to use when validating the token.

##### token

`string`

The JWT token to validate.

#### Returns

[`JWTPayload`](../interfaces/JWTPayload.md)

The data encoded in the token's payload.
