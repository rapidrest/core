[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / AlertUtilsAttachmentOptions

# Interface: AlertUtilsAttachmentOptions

Defined in: src/AlertUtils.ts:100

Describes the alert attachment options to use when creating an alert.

## Properties

### files

> **files**: [`AlertAttachment`](AlertAttachment.md)[]

Defined in: src/AlertUtils.ts:102

The attachment files to upload with the alert.

***

### indexFile?

> `optional` **indexFile**: `string`

Defined in: src/AlertUtils.ts:104

The name of the index file when the attachment is a zip file.

***

### zip?

> `optional` **zip**: `boolean`

Defined in: src/AlertUtils.ts:109

Set to `true` to to package all files into a single zip before being uploaded, otherwise set to `false` to
upload each file individually.
