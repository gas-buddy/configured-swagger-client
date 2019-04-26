import fetchPonyfill from 'fetch-ponyfill';
import EventSource from 'eventsource';
import { EventEmitter } from 'events';

const { fetch } = fetchPonyfill();

const CALLINFO = Symbol('Swagger call info key');
const logEverything = !!process.env.LOG_SWAGGER_CALLS;

function serviceFactory(swaggerConfigurator, req) {
  const { config } = swaggerConfigurator;
  return (clientClass) => {
    // Our job is to build the configuration for the client.
    // First, find out which client this is.
    const [serviceName] = Object.entries(config.clients).find(([, client]) => (client === clientClass || client === clientClass?.default)) || [];
    // If we don't know, throw an error
    if (!serviceName) {
      const err = new Error('Unknown service called');
      err.client = clientClass;
      throw err;
    }
    const { basePath = '', hostname = serviceName, port, protocol = 'https', noTracing, log } = config.endpoints[serviceName] || {};
    let newSpanLogger;
    const clientConfig = {
      fetch,
      EventSource,
      requestInterceptor(request, source) {
        source[CALLINFO] = {
          client: clientClass,
          serviceName,
          operationName: `${source.client}_${source.method}`,
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
        source[CALLINFO].status = status;
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
    this.config = config;
    context.service.on('request', (req) => {
      req.gb.serviceFactory = serviceFactory(this, req);
    });
  }

  start(context) {
    return serviceFactory(this, {
      headers: {
        correlationid: `${context.service.name}-global`,
      },
    });
  }
}
