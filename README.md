configured-swagger-client
=========================

[![wercker status](https://app.wercker.com/status/15fcfccb064836e35c8438135e37cd41/s/master "wercker status")](https://app.wercker.com/project/byKey/15fcfccb064836e35c8438135e37cd41)


GasBuddy has chosen [Swagger](http://swagger.io/) as our API format for all services. Luckily, a growing number of
partners are also using Swagger. Our services are written mostly in Node.js, and this module is an attempt to make the
process of wiring a Node.js project to Swagger services easier and more robust.

We have a variety of "independent components":

* -api - a Swagger API that is reachable by the outside world
* -serv - a Swagger API that is only reachable from other services
* -web - a non-Swagger service that exposts
* -job - a start-and-finish job that runs periodically or on demand

All of these components likely make use of other Swagger services. Each of these services is defined by a JSON swagger
specification and will use [small-swagger-codegen](https://github.com/gas-buddy/small-swagger-codegen) to generate a
client package. This is a departure from versions < 5.x of this library which generated a JSON spec and the
client was dynamically generated. THe value of pregeneration is full type information available at development time,
which includes autocompleting complex method names and request structures, which in a language like Javascript, can reduce
bugs significantly without losing the flexibility (since it's just a generator doing the typing work).

One of the other important things we do is create a "CorrelationId" - a single identifier which can be traced
all through the logs of all of the services that request touches. This module creates an easy way to pass that
CorrelationId along in dependent service calls.

See the tests for example usage, but here's a simple one:

```
import PetApi from 'a-node-module-from-small-swagger-codegen';

const petApi = new PetApi(req.gb.serviceFactory);

const pets = await services.Pets.findPetsByStatus({ status: 'pending' });
// pets.obj has your pets!
```

API Options
===========

The CorrelationId support is accomplished via a requestInterceptor option to the rest-api-support methods.
rest-api-support also supports adding headers (such as authorization headers) in this phase. Metric collection is also
enabled by the requestInterceptor/responseInterceptor pair.
