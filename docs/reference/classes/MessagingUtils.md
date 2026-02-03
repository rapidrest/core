[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / MessagingUtils

# Class: MessagingUtils

Defined in: src/MessagingUtils.ts:68

Simple utility class for sending templated messages via e-mail, SMS and more.

## Constructors

### Constructor

> **new MessagingUtils**(): `MessagingUtils`

#### Returns

`MessagingUtils`

## Properties

### slackApps

> `protected` **slackApps**: `any`[] = `[]`

Defined in: src/MessagingUtils.ts:69

***

### slackConfigs

> `protected` **slackConfigs**: `any`[] = `[]`

Defined in: src/MessagingUtils.ts:71

## Methods

### init()

> **init**(): `Promise`\<`void`\>

Defined in: src/MessagingUtils.ts:83

#### Returns

`Promise`\<`void`\>

***

### sendEmail()

> **sendEmail**(`templateName`, `templateVars`, `options`): `Promise`\<`any`\>

Defined in: src/MessagingUtils.ts:149

Sends an email using the given template name and variables.

#### Parameters

##### templateName

`string`

The name of the email template to send.

##### templateVars

`any`

The map of variables to inject into the template.

##### options

`any` = `{}`

The map of additional options to pass into the sendMail function.

#### Returns

`Promise`\<`any`\>

***

### sendSlack()

> **sendSlack**(`templateName`, `templateVars`): `Promise`\<`any`[] \| `undefined`\>

Defined in: src/MessagingUtils.ts:204

Sends an Slack message using the given template name and variables.

#### Parameters

##### templateName

`string`

The name of the Slack template to send.

##### templateVars

`any`

The map of variables to inject into the template.

#### Returns

`Promise`\<`any`[] \| `undefined`\>

***

### sendSMS()

> **sendSMS**(`templateName`, `templateVars`, `options`): `Promise`\<`any`\>

Defined in: src/MessagingUtils.ts:241

Sends an SMS using the given template name and variables.

#### Parameters

##### templateName

`string`

The name of the SMS template to send.

##### templateVars

`any`

The map of variables to inject into the template.

##### options

`any` = `{}`

The map of additional options to pass into the sendMail function.

#### Returns

`Promise`\<`any`\>
