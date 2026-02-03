[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / EventUtils

# Class: EventUtils

Defined in: src/TelemetryUtils.ts:84

Provides a common set of static functions for recording and working with telemetry `Event` instances.

The `init` function must be called before any other function can be called.

The `record` function is used to send an event to a configured `telemetry_services` service for permanent storage.

The `on` function allows code within the same application or service to listen for outgoing events that have been
sent via the `record` function.

## Author

Jean-Philippe Steinmetz <rapidrests@gmail.com>

## Constructors

### Constructor

> **new EventUtils**(): `EventUtils`

#### Returns

`EventUtils`

## Methods

### init()

> `static` **init**(`config`, `logger`, `jwtToken`): `void`

Defined in: src/TelemetryUtils.ts:99

Initializes `EventUtils` with the provided defaults.

#### Parameters

##### config

`any`

The application configuration to use.

##### logger

`any`

The logging utility to use.

##### jwtToken

`string`

The user's JWT token to send telemetry events on behalf of.

#### Returns

`void`

***

### on()

> `static` **on**(`type`, `callback`): `void`

Defined in: src/TelemetryUtils.ts:173

Registers a `callback` function to receive notifications of recorded events of the given `type`. Note that only
events originating from the same application or service will be notified.

#### Parameters

##### type

`string`

The type of event to be notified of.

##### callback

`Function`

The function to call when an event is recorded.

#### Returns

`void`

***

### record()

> `static` **record**(`evt`, `type?`): `Promise`\<`void`\>

Defined in: src/TelemetryUtils.ts:118

Sends the given event to the telemetry service for permanent recording.

#### Parameters

##### evt

`any`

The event to send and record.

##### type?

`string`

The type of event to record. Overrides any `type` value set in `evt`.

#### Returns

`Promise`\<`void`\>
