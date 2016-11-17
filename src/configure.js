import _ from 'lodash';
import URL from 'url';
import path from 'path';
import winston from 'winston';
import Client from 'swagger-client';
import jsonResolver from '@gasbuddy/swagger-ref-resolver';

/**
 * Find the best protocol scheme (http/https) for a given GasBuddy service
 */
function scheme(endpoints, swagger) {
  if (endpoints.default && endpoints.default.protocol) {
    return endpoints.default.protocol;
  }
  if (Array.isArray(swagger.schemes)) {
    if (swagger.schemes.includes('https')) {
      return 'https:';
    }
    return 'http:';
  }
  return 'https:';
}

/**
 * Take a set of services and endpoint configurations for those
 * services and return an object with the same keys as services
 * and configured swagger clients as values
 * @param {object} services The services to be created. The key should be the name of the service
 *  (the first letter of this will always be made upper and camel cases in the returned map)
 * @param {object} endpoints Any endpoint configuration for the services. The key should match
 *  the services parameter key, and the values include hostname, port, protocol, basePath,
 *  baseReferencePath. If the value is a string, it is assumed to be the URL of the target service.
 *  In absence of an endpoint configuration, the name of the service will be used as the name of the
 *  host.
 * @param {object} [options] Any options for all services
 * @param {string} options.basedir This module uses swagger-ref-resolver to resolve "enhanced"
 *  swagger documents. Any relative paths in those documents will use basedir
 * @param {function} options.postProcessor A function that will be called with information
 *  about the client (name, memberName, client) and the client itself (after it's wired up)
 * @param {function} options.preProcessor A function that will be called with information
 *  about the client that WILL BE configured - name, memberName, url and config
 */
export default async function configureServices(services, endpoints = {}, options = {}) {
  const swaggerResourceCache = options.swaggerResources;
  const returnedServices = {};
  const workToDo = [];
  for (const [name, swaggerSpec] of Object.entries(services)) {
    const configOverride = endpoints[name];

    if (configOverride && 'enabled' in configOverride && !configOverride.enabled) {
      // So damn pedantic. I decree this use to be worthy.
      // eslint-disable-next-line no-continue
      continue;
    }

    // The value of the services key should be either a URL or a swagger specification
    // (not as a string, but as the hydrated javascript object)
    let specJson = swaggerSpec;
    let url;
    if (typeof swaggerSpec === 'string') {
      url = swaggerSpec;
      specJson = undefined;
    } else {
      // Resolve multi-document swagger clients against a configurable base path
      let refBase = options.basedir || path.resolve('.');
      if (configOverride && configOverride.baseReferencePath) {
        refBase = path.resolve(refBase, configOverride.baseReferencePath);
      }
      if (!refBase.endsWith(path.sep)) {
        refBase = `${refBase}${path.sep}`;
      }

      specJson = await jsonResolver(specJson, refBase, swaggerResourceCache);
      if (typeof (configOverride) === 'string') {
        // Endpoint config is the URL of the service
        url = configOverride;
      } else if (configOverride) {
        // Endpoint config is input to URL.format with some tweaks
        const secScheme = configOverride.protocol || scheme(endpoints, swaggerSpec);
        const defaults = {
          hostname: name,
          protocol: secScheme,
        };
        defaults.port = secScheme.startsWith('https') ? 8443 : 8000;
        url = URL.format(Object.assign({}, defaults, configOverride));
      } else {
        // Use etcd/k8s for endpoint resolution by using the name of the service as a hostname
        const secScheme = scheme(endpoints, swaggerSpec);
        const defPort = secScheme.startsWith('https') ? 8443 : 8000;
        url = `${secScheme}//${name}:${defPort}`;
      }
    }

    // Sometimes it may be useful to override basePath and host directly
    if (specJson && configOverride && configOverride.basePath) {
      specJson.basePath = configOverride.basePath;
    }
    if (specJson && specJson.host && configOverride && configOverride.hostname) {
      specJson.host = configOverride.hostname;
    }

    winston.info('Connecting service', { name, url });
    const {
      username,
      authToken,
      authTokenLocation = 'header',
      securityScheme,
      password,
      swaggerOptions,
    } = configOverride || {};
    const clientConfig = Object.assign({
      url,
      spec: specJson,
      usePromise: true,
    }, swaggerOptions);
    if (username) {
      const schemeName = securityScheme || 'basic';
      const passAuth = new Client.PasswordAuthorization(username, password);
      clientConfig.authorizations = {
        [schemeName]: passAuth,
      };
    } else if (authToken) {
      const authTokenScheme = new Client.ApiKeyAuthorization('Authorization',
        `Bearer ${authToken}`,
        authTokenLocation);
      clientConfig.authorizations = clientConfig.authorizations || {};
      clientConfig.authorizations[securityScheme || 'authToken'] = authTokenScheme;
    }

    const workOrder = {
      url,
      name,
      memberName: _.upperFirst(_.camelCase(name)),
      config: clientConfig,
    };

    if (options.preProcessor) {
      await options.preProcessor(workOrder, configOverride);
    }
    workOrder.client = new Client(workOrder.config);
    workToDo.push(workOrder);
  }

  const clients = await Promise.all(workToDo.map(w => w.client));
  await Promise.all(clients.map(async (c, ix) => {
    const work = workToDo[ix];
    // Replace the promise with the real deal
    work.client = c;
    c.url = work.url;
    if (options.postProcessor) {
      await options.postProcessor(work);
    }
    returnedServices[work.memberName] = work.client;
  }));
  return returnedServices;
}
