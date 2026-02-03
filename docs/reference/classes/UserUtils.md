[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / UserUtils

# Class: UserUtils

Defined in: src/UserUtils.ts:16

Utilities for working with authenticated user objects. An user object is expected to have the following
properties.

* `uid` - Universally unique identifier for the user
* `email` - Unique e-mail address for the user
* `roles` - A list of unique names indicating the permissions of the user.
* `verified` - Indicates if the user's e-mail address has been verified.

## Author

Jean-Philippe Steinmetz <rapidrests@gmail.com>

## Constructors

### Constructor

> **new UserUtils**(): `UserUtils`

#### Returns

`UserUtils`

## Methods

### getExternalId()

> `static` **getExternalId**(`user`, `type`): `string` \| `undefined`

Defined in: src/UserUtils.ts:96

Returns the unique identifier of the specified type associated with the given user.

#### Parameters

##### user

`any`

The user to retrieve the external id from.

##### type

`string`

The type of external provider to retrieve.

#### Returns

`string` \| `undefined`

The unique id of the external provider for the given type if found, otherwise `undefined`.

***

### hasOrganization()

> `static` **hasOrganization**(`user`, `organizationUid`): `boolean`

Defined in: src/UserUtils.ts:22

Returns `true` if the given user object is a member of the organization with the specified uid, otherwise returns `false`.

#### Parameters

##### user

`any`

The user object to inspect.

##### organizationUid

`string`

The universally unique identifier of the persona to search for.

#### Returns

`boolean`

***

### hasOrganizations()

> `static` **hasOrganizations**(`user`, `organizationUids?`): `boolean`

Defined in: src/UserUtils.ts:39

Returns `true` if the given user object contains is a member of an organization matching one of the uids in the specified list, otherwise returns `false`.

#### Parameters

##### user

`any`

The user object to inspect.

##### organizationUids?

`string`[]

The list of universally unique identifiers to search for.

#### Returns

`boolean`

***

### hasPersona()

> `static` **hasPersona**(`user`, `personaUid?`): `boolean`

Defined in: src/UserUtils.ts:58

Returns `true` if the given user object contains a `Persona` object with the specified uid, otherwise returns `false`.

#### Parameters

##### user

`any`

The user object to inspect.

##### personaUid?

`string`

The universally unique identifier of the persona to search for.

#### Returns

`boolean`

***

### hasPersonas()

> `static` **hasPersonas**(`user`, `personaUids?`): `boolean`

Defined in: src/UserUtils.ts:75

Returns `true` if the given user object contains a `Persona` object matching one of the uids in the specified list, otherwise returns `false`.

#### Parameters

##### user

`any`

The user object to inspect.

##### personaUids?

`string`[]

#### Returns

`boolean`

***

### hasRole()

> `static` **hasRole**(`user`, `role?`, `orgUid?`): `boolean`

Defined in: src/UserUtils.ts:118

Returns `true` if the given user object has a role with the specified name, otherwise returns `false`.

#### Parameters

##### user

`any`

The user object to inspect.

##### role?

`string`

The unique name of the role to search for.

##### orgUid?

`string`

The unique identifier of an organization whose role will be verified.

#### Returns

`boolean`

***

### hasRoles()

> `static` **hasRoles**(`user`, `roles?`, `orgUid?`): `boolean`

Defined in: src/UserUtils.ts:143

Returns `true` if the given user object has at least one role from the specified list of names, otherwise returns `false`.

#### Parameters

##### user

`any`

The user object to inspect.

##### roles?

`string`[]

A list of unique names of the roles to search for.

##### orgUid?

`string`

The unique identifier of an organization whose role will be verified.

#### Returns

`boolean`
