[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / ObjectFactory

# Class: ObjectFactory

Defined in: src/ObjectFactory.ts:24

The `ObjectFactory` is a manager for creating objects based on registered
class types. This allows for the tracking of multiple instances of objects
so that references can be referenced by unique name.

## Author

Jean-Philippe Steinmetz

## Constructors

### Constructor

> **new ObjectFactory**(`config?`, `logger?`): `ObjectFactory`

Defined in: src/ObjectFactory.ts:37

#### Parameters

##### config?

`any`

##### logger?

`any`

#### Returns

`ObjectFactory`

## Properties

### classes

> `readonly` **classes**: `Map`\<`string`, `any`\>

Defined in: src/ObjectFactory.ts:26

A map for string fully qualified class names to their class types.

***

### config

> `protected` **config**: `any`

Defined in: src/ObjectFactory.ts:29

The global application configuration object.

***

### instances

> `readonly` **instances**: `Map`\<`string`, `any`\>

Defined in: src/ObjectFactory.ts:32

A map for the unique name to the intance of a particular class type.

***

### logger

> `protected` **logger**: `any`

Defined in: src/ObjectFactory.ts:35

The application logging utility.

## Methods

### clear()

> **clear**(): `void`

Defined in: src/ObjectFactory.ts:104

Deletes all instantiated objects.

#### Returns

`void`

***

### clearAll()

> **clearAll**(): `void`

Defined in: src/ObjectFactory.ts:111

Deletes all instantiated objects and registered class types.

#### Returns

`void`

***

### destroy()

> **destroy**(`objs?`): `Promise`\<`void`\>

Defined in: src/ObjectFactory.ts:47

Destroys the specified objects. If `undefined` is passed in, all objects managed by the factory are destroyed.

#### Parameters

##### objs?

`any`

#### Returns

`Promise`\<`void`\>

***

### getInitMethods()

> **getInitMethods**(`obj`): `Function`[]

Defined in: src/ObjectFactory.ts:186

Searches an object for one or more functions that implement a `@Init` decorator.

#### Parameters

##### obj

`any`

The object to search.

#### Returns

`Function`[]

The list of functions that implements the `@Init` decorator if found, otherwise undefined.

***

### getInstance()

> **getInstance**\<`T`\>(`nameOrType`): `T` \| `undefined`

Defined in: src/ObjectFactory.ts:220

Returns the object instance with the given unique name. Unique names take the form `<ClassName>:<InstanceName>`.
It is possible to only specifiy the `<ClassName>`, doing so will automatically look for the `<ClassName>:default`
instance or the first found instance of the given type.

#### Type Parameters

##### T

`T`

#### Parameters

##### nameOrType

`any`

The unique name or class type of the object to retrieve.

#### Returns

`T` \| `undefined`

The object instance associated with the given name if found, otherwise `undefined`.

***

### initialize()

> **initialize**\<`T`\>(`obj`): `Promise`\<`T`\>

Defined in: src/ObjectFactory.ts:120

Scans the given object for any properties with the `@Inject` decorator and assigns the correct values.

#### Type Parameters

##### T

`T`

#### Parameters

##### obj

`any`

The object to initialize with injected defaults

#### Returns

`Promise`\<`T`\>

***

### newInstance()

> **newInstance**\<`T`\>(`type`, `options?`): `T` \| `Promise`\<`T`\>

Defined in: src/ObjectFactory.ts:265

Creates a new instance of the class specified with the provided unique name or type and constructor arguments. If an existing
object has already been created with the given name, that instance is returned, otherwise a new instance is created
using the provided arguments.

#### Type Parameters

##### T

`T`

#### Parameters

##### type

`any`

The fully qualified name or type of the class to instantiate. If a type is given it's class name will be inferred
via the constructor name.

##### options?

[`InstanceOptions`](../interfaces/InstanceOptions.md)

#### Returns

`T` \| `Promise`\<`T`\>

***

### register()

> **register**(`clazz`, `fqn?`): `void`

Defined in: src/ObjectFactory.ts:336

Registers the given class type for the provided fully qualified name.

#### Parameters

##### clazz

`any`

The class type to register.

##### fqn?

`string`

The fully qualified name of the class to register. If not specified, the class name will be used.

#### Returns

`void`
