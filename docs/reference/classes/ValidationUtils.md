[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / ValidationUtils

# Class: ValidationUtils

Defined in: src/ValidationUtils.ts:14

A collection of validation functions to use with the `@Validator()` decorator.

## Constructors

### Constructor

> **new ValidationUtils**(): `ValidationUtils`

#### Returns

`ValidationUtils`

## Methods

### check()

> `static` **check**(`val`, `func`): `any`

Defined in: src/ValidationUtils.ts:23

A simple wrapper that calls the specified boolean validation function with the given value and returns the
value as a result if the validation function passes. Otherwise throws an error.

#### Parameters

##### val

`any`

The value to validate.

##### func

[`BooleanFunc`](../type-aliases/BooleanFunc.md)

The boolean validation function to check the value.

#### Returns

`any`

#### Throws

Throws an error if the value fails the boolean validation test.

***

### checkDate()

> `static` **checkDate**(`val`): `string`

Defined in: src/ValidationUtils.ts:33

Validates that the provided string represents a ISO, RFC or UTC date or timestamp.

#### Parameters

##### val

`string`

#### Returns

`string`

***

### checkEmail()

> `static` **checkEmail**(`val`): `string`

Defined in: src/ValidationUtils.ts:43

Validates that the provided string represents a valid e-mail address.

#### Parameters

##### val

`string`

#### Returns

`string`

***

### checkEmpty()

> `static` **checkEmpty**(`val`): `any`[]

Defined in: src/ValidationUtils.ts:53

Validates that the provided array is not empty.

#### Parameters

##### val

`any`[]

#### Returns

`any`[]

***

### checkIP()

> `static` **checkIP**(`val`): `string`

Defined in: src/ValidationUtils.ts:63

Validates that the provided string is a valid IP address.

#### Parameters

##### val

`string`

#### Returns

`string`

***

### checkJSON()

> `static` **checkJSON**(`val`): `string`

Defined in: src/ValidationUtils.ts:73

Validates that the provided string is valid JSON (note: uses `JSON.parse`).

#### Parameters

##### val

`string`

#### Returns

`string`

***

### checkName()

> `static` **checkName**(`val`): `string`

Defined in: src/ValidationUtils.ts:83

Validates that the provided string matches the regexp pattern /[a-zA-Z0-9_\-\.@:\+]+/.

#### Parameters

##### val

`string`

#### Returns

`string`

***

### checkNull()

> `static` **checkNull**(`val`): `any`

Defined in: src/ValidationUtils.ts:93

Validates that the provided object is not null or empty.

#### Parameters

##### val

`any`

#### Returns

`any`

***

### checkPhone()

> `static` **checkPhone**(`val`): `string`

Defined in: src/ValidationUtils.ts:103

Validates that the provided string represents a valid phone number.

#### Parameters

##### val

`string`

#### Returns

`string`

***

### checkSemVer()

> `static` **checkSemVer**(`val`): `string`

Defined in: src/ValidationUtils.ts:113

Validates that the provided string represents a semantic version.

#### Parameters

##### val

`string`

#### Returns

`string`

***

### checkURL()

> `static` **checkURL**(`val`): `string`

Defined in: src/ValidationUtils.ts:123

Validates that the provided string is a valid URL.

#### Parameters

##### val

`string`

#### Returns

`string`

***

### checkUUID()

> `static` **checkUUID**(`val`): `string`

Defined in: src/ValidationUtils.ts:133

Validates that the provided string is a valid UUID.

#### Parameters

##### val

`string`

#### Returns

`string`

***

### checkVersion()

> `static` **checkVersion**(`val`): `number`

Defined in: src/ValidationUtils.ts:143

Validates that the provided value is an entity `version` number (e.g. `value > 0`).

#### Parameters

##### val

`any`

#### Returns

`number`
