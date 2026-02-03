[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / ClassLoader

# Class: ClassLoader

Defined in: src/ClassLoader.ts:48

The *ClassLoader* provides a container for dynamically loading classes at runtime using C#/Java style namespaces.
Namespaces are determined from the folder structure relative to the root.

Class names are derived either directly from the modules export name or inferred from the module's file path when
the `default` export is used.

For example, given the following example TypeScript module at relative path `com/company/MyClass.ts` would register
a class with fully qualified name `com.company.MyClass`.

```javascript
export default class MyClass {
    // ...
}
```

In the event that multiple exports are defined, the fully qualified name will take on the export name instead of the
module name. Thus, the following example module at relative path `com/company/MyClasses.ts` would register the following
classes.
- `com.company.MyClass`
- `com.company.MyEnum`

```javascript
export class MyClass {
    // ...
}

export enum MyEnum {
    // ...
}
```

**IMPORTANT**: If you use *ClassLoader* to dynamically load TypeScript files (.ts, .cts, .mts, etc.) at runtime using
an ESM-only project you must use the `ts-node/esm` module loader. This can be specified by passing the `--loader` to
node at runtime.

```
node --loader ts-node/esm <module>
```

## Author

Jean-Philippe Steinmetz

## Constructors

### Constructor

> **new ClassLoader**(`rootDir`, `includeJavaScript`, `includeTypeScript`, `ignore`): `ClassLoader`

Defined in: src/ClassLoader.ts:67

Creates a new instance of `ClassLoader` with the specified defaults.

#### Parameters

##### rootDir

`string`

The root directory to load all classes from.

##### includeJavaScript

`boolean` = `true`

Set to `true` to load all TypeScript classes from the given `rootDir`, otherwise set to `false.
@param includeTypeScript Set to `true` to load all JavaScript classes from the given `rootDir`, otherwise set to `false.

##### includeTypeScript

`boolean` = `true`

##### ignore

(`string` \| `RegExp`)[] = `[]`

A list of regex pattern of file paths to ignore.

#### Returns

`ClassLoader`

## Properties

### classes

> `protected` **classes**: `Map`\<`string`, `any`\>

Defined in: src/ClassLoader.ts:50

The map containnig all loaded classes.

***

### ignore

> `protected` **ignore**: (`string` \| `RegExp`)[] = `[]`

Defined in: src/ClassLoader.ts:51

***

### includeJavaScript

> `protected` **includeJavaScript**: `boolean` = `true`

Defined in: src/ClassLoader.ts:55

Indicates if JavaScript classes should be loaded.

***

### includeTypeScript

> `protected` **includeTypeScript**: `boolean` = `true`

Defined in: src/ClassLoader.ts:53

Indicates if TypeScript classes should be loaded.

***

### rootDir

> `protected` **rootDir**: `string` = `"."`

Defined in: src/ClassLoader.ts:57

The path to the root directory containing all classes on disk.

## Methods

### getClass()

> **getClass**(`fqn`): `any`

Defined in: src/ClassLoader.ts:80

Returns the class with the specified fully qualified name.

#### Parameters

##### fqn

`string`

The fully qualified name of the class to return.

#### Returns

`any`

The class definition for the given fully qualified name if found, otherwise `undefined`.

***

### getClasses()

> **getClasses**(): `Map`\<`string`, `any`\>

Defined in: src/ClassLoader.ts:87

Returns the map containing all classes that have been loaded.

#### Returns

`Map`\<`string`, `any`\>

***

### hasClass()

> **hasClass**(`fqn`): `any`

Defined in: src/ClassLoader.ts:97

Returns `true` if a class exists with the specified fully qualified name.

#### Parameters

##### fqn

`string`

The fully qualified name of the class to search.

#### Returns

`any`

`true` if a class definition exists for the given fully qualified name, otherwise `false`.

***

### load()

> **load**(`dir`): `Promise`\<`void`\>

Defined in: src/ClassLoader.ts:107

Loads all modules exports contained in the directory specified. The folder must be a child
directory to the `rootDir` parameter passed in to the constructor.

#### Parameters

##### dir

`string` = `""`

The directory, relative to `rootDir`, containing modules to load.

#### Returns

`Promise`\<`void`\>
