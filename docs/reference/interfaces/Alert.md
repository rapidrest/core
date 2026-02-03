[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / Alert

# Interface: Alert

Defined in: src/AlertUtils.ts:40

Describes a single system failure or other similar critical event that requires immediate attention.

## Properties

### alias

> **alias**: `string`

Defined in: src/AlertUtils.ts:42

The name of the alert that uniquely identifies the report for purposes of de-duplication.

***

### description

> **description**: `string`

Defined in: src/AlertUtils.ts:44

The detailed information about the event that has occurred.

***

### details?

> `optional` **details**: `any`

Defined in: src/AlertUtils.ts:46

A key-value map of custom information about the alert.

***

### entity?

> `optional` **entity**: `string`

Defined in: src/AlertUtils.ts:48

Used to specify a category or problem domain for filtering.

***

### message

> **message**: `string`

Defined in: src/AlertUtils.ts:50

The basic summary of the alert that describes the event.

***

### note?

> `optional` **note**: `string`

Defined in: src/AlertUtils.ts:52

Additional detail about the event.

***

### priority

> **priority**: [`AlertPriority`](../enumerations/AlertPriority.md)

Defined in: src/AlertUtils.ts:54

The priority level of the alert.

***

### source

> **source**: `string`

Defined in: src/AlertUtils.ts:56

The source of the alert. Can be a pod/service name, IP address or other unique identifier.

***

### tags?

> `optional` **tags**: `string`[]

Defined in: src/AlertUtils.ts:58

A list of unique tags to associate with the event.
