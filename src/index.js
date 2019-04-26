import fetchPonyfill from 'fetch-ponyfill';
import EventSource from 'eventsource';
import { EventEmitter } from 'events';

const { fetch } = fetchPonyfill();

const CALLINFO = Symbol('Swagger call info key');

function serviceFactory(swaggerConfigurator, req) {
  const { config } = swaggerConfigurator;
  return (clientClass) => {
    // Our job is to build the configuration for the client.
    // First, find out which client this is.
    const [serviceName] = Object.entries(config.clients).find(([, client]) => client === clientClass) || [];
    // If we don't know, throw an error
    if (!serviceName) {
      const err = new Error('Unknown service called');
      err.client = clientClass;
      throw err;
    }
    const clientConfig = {
      fetch,
      EventSource,
      requestInterceptor(request, source) {
        source[CALLINFO] = { operationName: `${source.client}_${source.method}` };
        request.headers = request.headers || {};
        request.headers.correlationid = req.headers.correlationid;
        swaggerConfigurator.emit('start', source[CALLINFO]);
      },
      responseInterceptor(response, request, source) {
        const { status } = response;
        source[CALLINFO].status = status;
        if (status >= 200 && status <= 300) {
          swaggerConfigurator.emit('finish', source[CALLINFO]);
        } else {
          swaggerConfigurator.emit('error', source[CALLINFO]);
        }
      },
    };
    const { basePath = '', hostname = serviceName, port, protocol = 'https' } = config.endpoints[serviceName] || {};
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
