[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / ObjectUtils

# Class: ObjectUtils

Defined in: src/ObjectUtils.ts:12

Utility class for working with objects.

## Author

Jean-Philippe Steinmetz

## Constructors

### Constructor

> **new ObjectUtils**(): `ObjectUtils`

#### Returns

`ObjectUtils`

## Methods

### validate()

> `static` **validate**(`obj`, `clazz?`, `recurse?`): `void`

Defined in: src/ObjectUtils.ts:21

Performs validation of the given object or array. Validation is performed by scanning the object class for properties
decorated with `@Validator` and executing the provided validation function.

#### Parameters

##### obj

`any`

The object or array of objects to validate.

##### clazz?

`any`

The class type that contains the validation metadata.

##### recurse?

`boolean`

Set to `true` to validate all child objects.

#### Returns

`void`
