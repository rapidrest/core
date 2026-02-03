[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / Event

# Class: Event

Defined in: src/TelemetryUtils.ts:23

Describes a single telemetry event. A telemetry event is when something occurs in the system.

## Author

Jean-Philippe Steinmetz <rapidrests@gmail.com>

## Implements

- [`NewEvent`](../interfaces/NewEvent.md)

## Constructors

### Constructor

> **new Event**(`config`, `userId`, `data`): `Event`

Defined in: src/TelemetryUtils.ts:54

#### Parameters

##### config

`any`

##### userId

`string`

##### data

[`NewEvent`](../interfaces/NewEvent.md)

#### Returns

`Event`

## Properties

### environment

> `readonly` **environment**: `string`

Defined in: src/TelemetryUtils.ts:32

The name of the environment that the event originated from. This is typically `dev` or `prod`.

***

### origin

> `readonly` **origin**: `string`

Defined in: src/TelemetryUtils.ts:37

The unique name of the service or client that the event originated from.

***

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: src/TelemetryUtils.ts:42

The date and time that the event occured.

***

### type

> `readonly` **type**: `string`

Defined in: src/TelemetryUtils.ts:47

The type of event being recorded.

#### Implementation of

[`NewEvent`](../interfaces/NewEvent.md).[`type`](../interfaces/NewEvent.md#type)

***

### uid

> `readonly` **uid**: `string`

Defined in: src/TelemetryUtils.ts:27

The universally unique identifier of the event.

***

### userId

> `readonly` **userId**: `string`

Defined in: src/TelemetryUtils.ts:52

The universally unique identifer of the user that sent the event.
