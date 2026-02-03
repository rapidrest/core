[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / AlertAttachment

# Interface: AlertAttachment

Defined in: src/AlertUtils.ts:64

Describes a single attachment that can be added to an alert.

## Properties

### contentType

> **contentType**: `string`

Defined in: src/AlertUtils.ts:66

The content-type of the attachment.

***

### data

> **data**: `Buffer`\<`ArrayBufferLike`\> \| `ReadStream`

Defined in: src/AlertUtils.ts:68

The contents of the attachment.

***

### filename

> **filename**: `string`

Defined in: src/AlertUtils.ts:70

The name of the attachment.

***

### size?

> `optional` **size**: `number`

Defined in: src/AlertUtils.ts:72

The size of the attachment.
