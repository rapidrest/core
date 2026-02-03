[**@rapidrest/core**](../README.md)

***

[@rapidrest/core](../README.md) / AlertPriority

# Enumeration: AlertPriority

Defined in: src/AlertUtils.ts:24

Describes the level of priority for a given alert and an importance for triaging the problem.

## Enumeration Members

### Critical

> **Critical**: `"P1"`

Defined in: src/AlertUtils.ts:26

Describes an alert that affects critical operating functionality or infrastructure.

***

### Important

> **Important**: `"P3"`

Defined in: src/AlertUtils.ts:30

Describes an alert that affects basic systems that may create a poor end-user experience.

***

### Notice

> **Notice**: `"P5"`

Defined in: src/AlertUtils.ts:34

Describes an alert that has no material affect on end-user experience and no potential for escalation.

***

### Severe

> **Severe**: `"P2"`

Defined in: src/AlertUtils.ts:28

Describes an alert that affects key systems that have great impact on end-user experiences.

***

### Warning

> **Warning**: `"P4"`

Defined in: src/AlertUtils.ts:32

Describes an alert that has no material affect on the end-user experience but with potential to escalate.
