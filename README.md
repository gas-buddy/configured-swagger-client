configured-swagger-client
=========================

[![Greenkeeper badge](https://badges.greenkeeper.io/gas-buddy/configured-swagger-client.svg)](https://greenkeeper.io/)

GasBuddy has chosen [Swagger](http://swagger.io/) as our API format for all internal services. Luckily, a growing number of partners
are also using Swagger. Our services are written mostly in Node.js, and this module is an attempt to make the process of wiring
a Node.js project to Swagger services easier and more robust.

We have a variety of "independent components":

* -api - a Swagger API that is reachable by the outside world
* -serv - a Swagger API that is only reachable from other services
* -web - a non-Swagger service that exposts
* -job - a start-and-finish job that runs periodically or on demand

All of these components likely make use of other Swagger services. Each of these services is defined by a JSON swagger
specification. We don't really like having to fetch that specification at runtime, so this module supports passing that
JSON directly, for example from a node module that contains the spec. The module also supports a URL in cases where that
makes more sense (usually because you don't control what the service actually implements). Separately, you may want to configure
the WAY that you reach that implementation - overriding the host, port, protocol, basePath, etc.

One of the other important things we do is create a "CorrelationId" - a single identifier which can be traced
all through the logs of all of the services that request touches. This module creates an easy way to pass that
CorrelationId along in dependent service calls.

This module **requires** node 6+ because of the Proxy stuff that implements the CorrelationId capability. We use this
with [Confit](https://github.com/krakenjs/confit) to create service connections wholly in configuration files. This
results in a service collection that contains [swagger-js](https://github.com/swagger-api/swagger-js) clients.

See the tests for example usage, but here's a simple one:

```
  const services = await clientConfig.configureServices({
    pets: 'http://petstore.swagger.io/v2/swagger.json',
  });
  const pets = await services.Pets.pet.findPetsByStatus({
    status: 'pending',
  });
  // pets.obj has your pets!
```

API Options
===========

The CorrelationId support is accomplished via a requestInterceptor option to swagger-js API methods. We
can attach this method to the request object (in express) as middleware without having to shim every
possible API call by using ES6 proxies. Basically, if you call an API on a Swagger service that you
configured with configureServices and passed through servicesWithOptions, it will automatically add
whatever options you passed to servicesWithOptions as the second parameter of the swagger-js call.
A psuedo-code example of this flow is below:

```
app.services = configureServices(app.config.get('services'), app.config.get('endpoints'));
app.use((req, res, next) => {
  if (!req.correlationId) {
    req.correlationId = req.headers.correlationid || uuid.v4();
  }
  req.services = servicesWithOptions(app.services, {
    requestInterceptor: function addId() {
      this.headers.CorrelationId = req.correlationId;
      return this;
    },
  });
});
```
