[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / JWTPayload

# Interface: JWTPayload

Defined in: src/JWTUtils.ts:38

Describes the payload data structure of signed JWT tokens.

## Extends

- `JwtPayload`

## Indexable

\[`key`: `string`\]: `any`

## Properties

### aud?

> `optional` **aud**: `string` \| `string`[]

Defined in: node\_modules/@types/jsonwebtoken/index.d.ts:115

#### Inherited from

`jwt.JwtPayload.aud`

***

### compression?

> `optional` **compression**: `"zlib"`

Defined in: src/JWTUtils.ts:40

Indicates if the payload profile has been compressed and with what method.

***

### encryption?

> `optional` **encryption**: `boolean`

Defined in: src/JWTUtils.ts:43

Indicates if the payload profile has been encrypted.

***

### exp?

> `optional` **exp**: `number`

Defined in: node\_modules/@types/jsonwebtoken/index.d.ts:116

#### Inherited from

`jwt.JwtPayload.exp`

***

### iat?

> `optional` **iat**: `number`

Defined in: node\_modules/@types/jsonwebtoken/index.d.ts:118

#### Inherited from

`jwt.JwtPayload.iat`

***

### iss?

> `optional` **iss**: `string`

Defined in: node\_modules/@types/jsonwebtoken/index.d.ts:113

#### Inherited from

`jwt.JwtPayload.iss`

***

### jti?

> `optional` **jti**: `string`

Defined in: node\_modules/@types/jsonwebtoken/index.d.ts:119

#### Inherited from

`jwt.JwtPayload.jti`

***

### nbf?

> `optional` **nbf**: `number`

Defined in: node\_modules/@types/jsonwebtoken/index.d.ts:117

#### Inherited from

`jwt.JwtPayload.nbf`

***

### profile

> **profile**: `string` \| [`JWTUser`](JWTUser.md)

Defined in: src/JWTUtils.ts:46

The user profile of the authenticated user the token is valid for.

***

### sessionUid

> **sessionUid**: `string`

Defined in: src/JWTUtils.ts:49

The unique identifier of the user's authentication session.

***

### sub?

> `optional` **sub**: `string`

Defined in: node\_modules/@types/jsonwebtoken/index.d.ts:114

#### Inherited from

`jwt.JwtPayload.sub`
