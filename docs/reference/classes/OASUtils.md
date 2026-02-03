[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / OASUtils

# Class: OASUtils

Defined in: src/OASUtils.ts:12

## Constructors

### Constructor

> **new OASUtils**(): `OASUtils`

#### Returns

`OASUtils`

## Methods

### getDatastore()

> `static` **getDatastore**(`spec`, `name`): `any`

Defined in: src/OASUtils.ts:20

Gets the datastore definition with the specified name.

#### Parameters

##### spec

`any`

The OpenAPI specification to search.

##### name

`string`

The name of the datastore to retrieve.

#### Returns

`any`

The definition for the datastore with the given name if found, otherwise `undefined`.

***

### getObject()

> `static` **getObject**(`spec`, `path`): `any`

Defined in: src/OASUtils.ts:37

Gets the specification object at the specified path.

#### Parameters

##### spec

`any`

The OpenAPI specification to reference.

##### path

`string`

The path of the object to retrieve.

#### Returns

`any`

The object at the specified path if found, otherwise `undefined`.

***

### getResponse()

> `static` **getResponse**(`obj`): `any`

Defined in: src/OASUtils.ts:64

Returns the first available response object for a 2XX response as defined by the provided Operation schema object.

#### Parameters

##### obj

`any`

The Operation schema object to search.

#### Returns

`any`

***

### getResponseContent()

> `static` **getResponseContent**(`obj`): `any`

Defined in: src/OASUtils.ts:83

Returns the first available response content object for a 2XX response as defined by the provided Operation schema object.

#### Parameters

##### obj

`any`

The Operation schema object to search.

#### Returns

`any`

***

### getSchema()

> `static` **getSchema**(`spec`, `name`): `any`

Defined in: src/OASUtils.ts:95

Retrieves the schema definition with the given name.

#### Parameters

##### spec

`any`

The OpenAPI specification object to reference.

##### name

`string`

The name of the schema to retrieve.

#### Returns

`any`

The schema definition with the given name.

***

### getTypeInfo()

> `static` **getTypeInfo**(`schemaDef`, `spec`, `convertDataType`): `any`

Defined in: src/OASUtils.ts:118

Extracts the type information for a given schema Object definition.

#### Parameters

##### schemaDef

`any`

The schema definition object to extract type information from.

##### spec

`any`

The entire OpenAPI specification object.

##### convertDataType

`Function`

The function that converts OpenAPI Specification types to native types.

#### Returns

`any`

A tuple containing the type, subType and subSchemaRef information.

***

### loadSpec()

> `static` **loadSpec**(`file`): `Promise`\<`any`\>

Defined in: src/OASUtils.ts:173

Attempts to load the Open API specification at the given path or URL.

#### Parameters

##### file

`string`

The path or URL of the OpenAPI Specification file to load.

#### Returns

`Promise`\<`any`\>

A promise whose result will be the loaded OpenAPI Specification as an object.
