[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / AlertUtils

# Class: AlertUtils

Defined in: src/AlertUtils.ts:116

The `AlertUtils` class is used to send alerts about important system events that have occurred
and require further monitoring or intervention.

## Constructors

### Constructor

> **new AlertUtils**(`options`): `AlertUtils`

Defined in: src/AlertUtils.ts:128

Creates a new instance of `AuthUtils` with the provided defaults.

#### Parameters

##### options

[`AlertUtilsOptions`](../interfaces/AlertUtilsOptions.md)

The configuration options to use.

#### Returns

`AlertUtils`

## Methods

### addAttachment()

> **addAttachment**(`id`, `attachment`, `indexFile?`): `Promise`\<`boolean`\>

Defined in: src/AlertUtils.ts:298

Uploads a single attachment to the alert with the given unique identifier.

#### Parameters

##### id

`string`

The unique identifier of the alert to add an attachment for.

##### attachment

[`AlertAttachment`](../interfaces/AlertAttachment.md)

The file to upload as an attachment.

##### indexFile?

`string`

Sets the indexFile parameter of the request.

#### Returns

`Promise`\<`boolean`\>

True if the operation was successful, otherwise false.

***

### close()

> **close**(`id`, `data`): `Promise`\<`boolean`\>

Defined in: src/AlertUtils.ts:139

Attempts to close the existing alert with the given identifier.

#### Parameters

##### id

`string`

The unique identifier of the alert to close.

##### data

[`AlertClose`](../interfaces/AlertClose.md) = `{}`

#### Returns

`Promise`\<`boolean`\>

True if the operation was successful, otherwise false.

***

### get()

> **get**(`id`): `Promise`\<[`Alert`](../interfaces/Alert.md) \| `null`\>

Defined in: src/AlertUtils.ts:167

Attempts to retrieve the existing alert with the given identifier.

#### Parameters

##### id

`string`

The unique identifier of the alert to retrieve.

#### Returns

`Promise`\<[`Alert`](../interfaces/Alert.md) \| `null`\>

The retrieved alert if successful, otherwise `null`.

***

### send()

> **send**(`alert`, `vars`, `attachments?`): `Promise`\<`string` \| `null`\>

Defined in: src/AlertUtils.ts:191

Sends the provided alert to the configured monitoring service.

#### Parameters

##### alert

[`Alert`](../interfaces/Alert.md)

The alert to send.

##### vars

`any` = `{}`

A map of vars to perform replacement on for the alert's various properties.

##### attachments?

[`AlertUtilsAttachmentOptions`](../interfaces/AlertUtilsAttachmentOptions.md)

The attachments to upload along with the alert.

#### Returns

`Promise`\<`string` \| `null`\>

The unique identifier of the created alert if the operation was successful, otherwise `null`.
