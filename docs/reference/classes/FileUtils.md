[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / FileUtils

# Class: FileUtils

Defined in: src/FileUtils.ts:18

Utility functions for working with files.

## Author

Jean-Philippe Steinmetz

## Constructors

### Constructor

> **new FileUtils**(): `FileUtils`

#### Returns

`FileUtils`

## Methods

### copyBinaryFile()

> `static` **copyBinaryFile**(`srcPath`, `outPath`, `variables`): `Promise`\<`void`\>

Defined in: src/FileUtils.ts:160

Generates a copy of the source file at the desired output destination using binary copy mode.

#### Parameters

##### srcPath

`string`

The source file to copy.

##### outPath

`string`

The destination file to generate.

##### variables

`any` = `{}`

The map of variable names to values to swap. Applies to outPath only.

#### Returns

`Promise`\<`void`\>

***

### copyDirectory()

> `static` **copyDirectory**(`srcPath`, `outPath`, `vars`, `excludeFilters`, `binaryFilters`, `force`): `Promise`\<`void`\>

Defined in: src/FileUtils.ts:188

Performs a deep copy of a directory tree at the given srcPath to the specified output directory. Performs
template replacement for all variables given and skips any files in the specified filter.

#### Parameters

##### srcPath

`string`

The path to the source directory to copy files from.

##### outPath

`string`

The path to the destination directory to copy files to.

##### vars

`any` = `{}`

The map of template variables to perform replacement on.

##### excludeFilters

`string`[] = `[]`

The list of file extension filters to exclude during the copy process.

##### binaryFilters

`string`[] = `[]`

The list of file extension filters to copy as binary only.

##### force

`boolean` = `false`

Set to `true` to force writing over any existing files.

#### Returns

`Promise`\<`void`\>

***

### copyFile()

> `static` **copyFile**(`srcPath`, `outPath`, `variables`, `overwrite`): `Promise`\<`void`\>

Defined in: src/FileUtils.ts:124

Generates a copy of the source file at the desired output destination and performs a swap of all values of the
variables specified.

#### Parameters

##### srcPath

`string`

The source file to copy.

##### outPath

`string`

The destination file to generate.

##### variables

`any` = `{}`

The map of variable names to values to swap.

##### overwrite

`boolean` = `false`

#### Returns

`Promise`\<`void`\>

***

### writeFile()

> `static` **writeFile**(`srcPath`, `outPath`, `contents`, `overwrite`): `Promise`\<`void`\>

Defined in: src/FileUtils.ts:29

Attempts to write the provided contents to the file path given. If a file already exists the user is prompted to
allow the file to be overwritten or merged. In the case of a merge, srcPath is used as a baseline in order to
perform a 3-way merge.

#### Parameters

##### srcPath

`string`

The baseline template file to use during a merge.

##### outPath

`string`

The destination file path to be written.

##### contents

`any`

The contents of the file to write.

##### overwrite

`boolean` = `false`

Set to `true` to overwite the file and not perform a merge.

#### Returns

`Promise`\<`void`\>
