import defaultFetch from 'node-fetch';
import EventSource from 'eventsource';
import { EventEmitter } from 'events';

const CONFIG_FUNCTION = Symbol.for('small-swagger-codegen::configurationGenerator');
const CALLINFO = Symbol('Swagger call info key');
const logEverything = !!process.env.LOG_SWAGGER_CALLS;

function findServiceName(clientClass, clients) {
  const matchedEntry = Object.entries(clients)
    .find(([, client]) => (client?.default === clientClass || client === clientClass))
    || Object.entries(clients)
      .find(([, client]) => (client?.default?.name === clientClass.name || client.name === clientClass.name));
  return matchedEntry?.[0];
}

function serviceFactory(swaggerConfigurator, req) {
  const { config } = swaggerConfigurator;
  return (clientClass) => {
    // Our job is to build the configuration for the client.
    // First, find out which client this is.
    const serviceName = findServiceName(clientClass, config.clients);
    // If we don't know, throw an error
    if (!serviceName) {
      const err = new Error('Unknown service called');
      err.client = clientClass;
      throw err;
    }
    const { basePath = '', hostname = serviceName, port, protocol = 'https', noTracing, log } = config.endpoints[serviceName] || {};
    let newSpanLogger;
    const clientConfig = {
      fetch: config.fetch,
      EventSource,
      requestInterceptor(request, source) {
        source[CALLINFO] = {
          client: clientClass,
          serviceName,
          operationName: source.method,
          request,
        };
        request.headers = request.headers || {};
        if (!noTracing) {
          request.headers.correlationid = req.headers?.correlationid;
          newSpanLogger = req.gb?.logger?.loggerWithNewSpan?.();
          request.headers.span = newSpanLogger?.spanId;
        }
        if ((log || logEverything) && req.gb?.logger) {
          req.gb.logger.info('api-req', {
            url: request.url,
            m: request.method,
            childSp: newSpanLogger?.spanId,
          });
        }
        swaggerConfigurator.emit('start', source[CALLINFO]);
      },
      responseInterceptor(response, request, source) {
        const { status } = response;
        source[CALLINFO].response = response;
        if ((log || logEverything) && req.gb?.logger) {
          req.gb.logger.info('api-res', {
            s: response.status,
            l: response.headers['content-length'] || 0,
            childSp: newSpanLogger?.spanId,
          });
        }
        if (status >= 200 && status <= 300) {
          swaggerConfigurator.emit('finish', source[CALLINFO]);
        } else {
          swaggerConfigurator.emit('error', source[CALLINFO]);
        }
      },
    };
    const finalPort = port || (protocol.startsWith('https') ? 8443 : 8000);
    clientConfig.baseUrl = `${protocol}${protocol.endsWith(':') ? '//' : '://'}${hostname}:${finalPort}${basePath}`;
    return clientConfig;
  };
}

export default class SwaggerClientConfigurator extends EventEmitter {
  constructor(context, config) {
    super();
    this.config = {
      fetch: defaultFetch,
      ...config,
    };
    context.service.on('request', (req) => {
      const factory = serviceFactory(this, req);
      req[CONFIG_FUNCTION] = factory;
      req.gb.serviceFactory = factory;
    });
  }

  start(context) {
    const globalFactory = serviceFactory(this, {
      headers: {
        correlationid: `${context.service.name}-global`,
      },
    });
    // Provide to the event emitter methods to the containing service
    globalFactory.events = this;
    context.service[CONFIG_FUNCTION] = globalFactory;
    return globalFactory;
  }
}
