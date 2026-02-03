[**@rapidrest/core**](../../../../README.md)

***

[@rapidrest/core](../../../../README.md) / [ObjectDecorators](../README.md) / Config

# Function: Config()

> **Config**(`path?`, `defaultValue?`): (`target`, `propertyKey`) => `void`

Defined in: src/decorators/ObjectDecorators.ts:63

Apply this to a property to have a configuration variable be injected at instantiation. If no path is given, the
global configuration object is injected.

## Parameters

### path?

`string`

The path to the configuration variable to inject.

### defaultValue?

`any` = `undefined`

Set to the desired default value. If `undefined` is specified then an error is thrown if
no config variable is found at the given path.

## Returns

> (`target`, `propertyKey`): `void`

### Parameters

#### target

`any`

#### propertyKey

`string` | `symbol`

### Returns

`void`
