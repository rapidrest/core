[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / StringUtils

# Class: StringUtils

Defined in: src/StringUtils.ts:10

Utility functions for working with strings.

## Author

Jean-Philippe Steinmetz

## Constructors

### Constructor

> **new StringUtils**(): `StringUtils`

#### Returns

`StringUtils`

## Methods

### findAndReplace()

> `static` **findAndReplace**(`contents`, `variables`): `string`

Defined in: src/StringUtils.ts:46

Performs a search and replace on the provided contents with the map of variable replacements. The contents
must use Mustache formatted tokens such as `{{toreplace}}`.

#### Parameters

##### contents

`string`

The stringt to perform the find and replace on.

##### variables

`any`

A map of key=>value pairs to search for and replace.

#### Returns

`string`

***

### getParameters()

> `static` **getParameters**(`str`): `string`[]

Defined in: src/StringUtils.ts:18

Returns a list of all parameters contained within the string. A parameter is a bracket delimited substring
(e.g. /my/{key}/with/{id}).

#### Parameters

##### str

`string`

The string to search for parameters.

#### Returns

`string`[]

A list of parameters contained in the provided string.

***

### replaceAll()

> `static` **replaceAll**(`str`, `match`, `prefix`): `string`

Defined in: src/StringUtils.ts:82

Replaces all instances of the match regex pattern with the contents of the inner regular expression pattern for
the given string.

e.g.

let result = replaceAll('/my/path/{id}', new RegExp('\{([^\}]+)\}'), ':');
console.log(result); // -> /my/path/:id

#### Parameters

##### str

`string`

The string to perform replacement on.

##### match

The regular expression pattern to match containing an outer and inner pattern.

`string` | `RegExp`

##### prefix

`string`

The prefix to prepend the replacement text with.

#### Returns

`string`

The fully replaced contents of the string.

***

### toCamelCase()

> `static` **toCamelCase**(`str`): `string`

Defined in: src/StringUtils.ts:100

Converts the first character in the given string to be lowercase (e.g. myVariable).

#### Parameters

##### str

`string`

The string to convert to camelCase.

#### Returns

`string`

The string converted to camelCase.

***

### toPascalCase()

> `static` **toPascalCase**(`str`): `string`

Defined in: src/StringUtils.ts:110

Converts the first character in the given string to be uppercase (e.g. MyVariable).

#### Parameters

##### str

`string`

The string to convert to PascalCase.

#### Returns

`string`

The string converted to PascalCase.
