[**@rapidrest/core**](../../../../README.md)

***

[@rapidrest/core](../../../../README.md) / [ObjectDecorators](../README.md) / Init

# Function: Init()

> **Init**(`target`, `propertyKey`, `descriptor`): `void`

Defined in: src/decorators/ObjectDecorators.ts:51

Apply this to a function to be executed once a new object instance has been created and all dependencies injected.
Note: If the decorated function returns a Promise it is not gauranteed to finish execution before the object is
returned during the instantiation process.

## Parameters

### target

`any`

### propertyKey

`string`

### descriptor

`PropertyDescriptor`

## Returns

`void`
