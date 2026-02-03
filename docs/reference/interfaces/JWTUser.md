[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / JWTUser

# Interface: JWTUser

Defined in: src/JWTUtils.ts:13

Describes user data that is encoded in the payload of a JWT token.

## Author

Jean-Philippe Steinmetz <rapidrests@gmail.com>

## Properties

### name

> **name**: `string`

Defined in: src/JWTUtils.ts:22

The unique name of the user.

***

### roles

> **roles**: `string`[]

Defined in: src/JWTUtils.ts:27

The list of roles (by name) that the user is apart of and will assume privileges for.

***

### uid

> **uid**: `string`

Defined in: src/JWTUtils.ts:17

The universally unique identifier of the user.

***

### verified?

> `optional` **verified**: `boolean`

Defined in: src/JWTUtils.ts:32

Indicates if the user's e-mail address has been verified.
