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

1.4.0
=====
* Support chaining requestInterceptor and responseInterceptor so we don't drop handlers on the floor.

2.0.0
=====
* Supports node 8 only

2.2.0
=====
* Add a symbol and a property using that symbol to the objects passed as "this" to request/response interceptors. The value of this property is an Error object whose stack was captured at the BEGINNING of the Swagger request, which often makes a more meaningful trace.

2.3.1
=====
* Fix error symbol when options are not passed (meaning, like all the time)

5.0.0
======
* A complete rewrite using pre-generated swagger clients which significantly simplifies essentially all parts of this module

Migration:
----------
* There are no more tag names in swagger specs currently, so that's a big change
* Instead of `req.gb.services.FooServ.default.method_name()` it is now:
```
const fooServ = new FooServ(req);
fooServ.method_name();
```
* In your config.json(s), change "services" to "serviceFactory", and change "specs" to "clients", and then update all the package names to point to the generated-code version (e.g. feature-api-spec becomes feature-api-js-client)
* No more "expects" on the promise, just "expect" - so canonicalize that