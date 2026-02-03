[**@rapidrest/core**](../../../../README.md)

***

[@rapidrest/core](../../../../README.md) / [ObjectDecorators](../README.md) / Validator

# Function: Validator()

> **Validator**(`func`): (`target`, `propertyKey`) => `void`

Defined in: src/decorators/ObjectDecorators.ts:112

Apply this to a property to specify the function that will be used to perform validation of the value.

## Parameters

### func

[`ValidatorFunction`](../type-aliases/ValidatorFunction.md)

The validation function to use for the given property.

## Returns

> (`target`, `propertyKey`): `void`

### Parameters

#### target

`any`

#### propertyKey

`string` | `symbol`

### Returns

`void`
