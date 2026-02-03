[**@rapidrest/core**](../../../../README.md)

***

[@rapidrest/core](../../../../README.md) / [ObjectDecorators](../README.md) / Inject

# Function: Inject()

> **Inject**(`type`, `options?`): (`target`, `propertyKey`) => `void`

Defined in: src/decorators/ObjectDecorators.ts:23

Injects an object instance to the decorated property of the given name and type using the provided arguments
if no object has been created yet.

## Parameters

### type

`any`

The fully qualified name or type of the class to instantiate. If a type is given it's class name will be inferred
via the constructor name.

### options?

[`InstanceOptions`](../../../../interfaces/InstanceOptions.md)

## Returns

> (`target`, `propertyKey`): `void`

### Parameters

#### target

`any`

#### propertyKey

`string` | `symbol`

### Returns

`void`
