# Release Notes

## v1.3.0

* Fixed issue in ThreadPool that caused runaway memory usage
* Improved message passing in ThreadPool when sending messages to workers
* Removed synchronize function calls from multiple areas to improve execution performance
* Added caching of class metadata in ObjectFactory to improve traversal performance
* Added pre-compiled regex patterns for improved string search
* Added pre-compiling of handlebars templates
* Added caching of OpenAPI specification data
* Adding cache map to Logger to reduce extra instances from being created for the same level/file.
* Other performance improvements

## v1.2.0

* `ObjectFactory.newInstance` and `ObjectFactory.initialize` now returns synchronously for classes that do not have asynchronous initialization
* Fixed vulnerability with JWTUtils that allowed an attacker to easily decipher encrypted profiles
* Fixed multiple issues with ESM support
* Upgraded all dependencies to latest version

## v1.1.0

* MessagingUtils can now load templates from files

## v1.0.0

* Alert & Notification System
* Class Loader
* File management utilities
* JSON Web Token utilities
* Object Factory
* OpenAPI utilities
* String utilities
* Telemetry utilities
* Thread-pool Manager
* User authentication utilities
* Validation utilities
