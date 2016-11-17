1.2.2
=====
* Don't throw an exception if you ask for a non-existent method name (just return null)

1.2.1
=====
* Support promises properly, add test to illustrate

1.2.0
=====
* Add a preProcessor option for modifying swagger configuration
* Support promises for both preProcessor and postProcessor

1.1.0
=====
* Change postProcessor function signature to get all properties as an object. Strictly, this
is a violation of semver. Realistically, it's been like an hour, so I will unpublish the previous.

1.0.1
=====
* Add CHANGELOG.md
* Fix README.md markdown for links

1.3.0
=====
* Add simple class to allow direct hydration from a (to-be-released) configuration layer
* Added 'enabled' property on endpoint config that, when false, will not create the specified service client
