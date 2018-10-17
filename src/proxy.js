export const OriginalCallPropertyKey = Symbol('An error object that is created at original call time for a Swagger call');
export const CallPathPropertyKey = Symbol('The configured service name and method used in the current call');

function chainInterceptors(defaultOptions, explicitOptions, placeholderError, opInfo) {
  const combined = Object.assign({}, defaultOptions, explicitOptions);
  combined.requestInterceptor = function combinedRequestInterceptor(...args) {
    this[OriginalCallPropertyKey] = placeholderError;
    this[CallPathPropertyKey] = opInfo;
    if (explicitOptions && explicitOptions.requestInterceptor) {
      explicitOptions.requestInterceptor.apply(this, args);
    }
    if (defaultOptions && defaultOptions.requestInterceptor) {
      defaultOptions.requestInterceptor.apply(this, args);
    }
  };
  if (defaultOptions && explicitOptions
    && defaultOptions.responseInterceptor
    && explicitOptions.responseInterceptor) {
    combined.responseInterceptor = function combinedResponseInterceptor(...args) {
      explicitOptions.responseInterceptor.apply(this, args);
      defaultOptions.responseInterceptor.apply(this, args);
    };
  }
  return combined;
}

export function servicesWithOptions(serviceCollection, options) {
  // This proxy function is used for each API on each service
  const apiHandler = {
    get(target, key) {
      if (target[key]) {
        const returnFunction = (params, explicitOptions) => {
          const placeholderError = new Error();
          Error.captureStackTrace(placeholderError, returnFunction);
          let defaultOptions = options;
          if (typeof options === 'function') {
            defaultOptions = options(key, params, explicitOptions);
          }
          const opInfo = [target[CallPathPropertyKey], key];
          const finalOptions = chainInterceptors(
            defaultOptions,
            explicitOptions,
            placeholderError,
            opInfo,
          );

          // Provide a convenience method on the promise
          return Object.assign(
            target[key](params, finalOptions), {
              expect(...codes) {
                return this.catch((error) => {
                  if (codes.includes(error.status)) {
                    return {
                      errObj: error,
                      response: error.response,
                      status: error.status,
                      statusCode: error.statusCode,
                      body: error.response && error.response.body,
                    };
                  }
                  throw error;
                });
              },
              expects(...codes) {
                return this.catch((error) => {
                  if (codes.includes(error.status)) {
                    return {
                      errObj: error,
                      response: error.response,
                      status: error.status,
                      statusCode: error.statusCode,
                      body: error.response && error.response.body,
                    };
                  }
                  throw error;
                });
              },
            },
          );
        };
        return returnFunction;
      }
      return target[key];
    },
  };

  // This proxy function is used for each service
  const serviceHandler = {
    get(target, key) {
      if (typeof target[key] === 'object') {
        const newProxy = new Proxy(target[key], apiHandler);
        newProxy[CallPathPropertyKey] = target[CallPathPropertyKey];
        return newProxy;
      }
      return target[key];
    },
  };

  const clientHandler = {
    get(target, key) {
      if (key === 'apis') {
        const newProxy = new Proxy(target.apis, serviceHandler);
        newProxy[CallPathPropertyKey] = target[CallPathPropertyKey];
        return newProxy;
      }
      if (typeof target.apis[key] === 'object') {
        const newProxy = new Proxy(target.apis[key], apiHandler);
        newProxy[CallPathPropertyKey] = target[CallPathPropertyKey];
        return newProxy;
      }
      return target[key];
    },
  };

  const proxied = {};
  // And this little proxy intercepts serviceCollection
  const collectionProxy = {
    get(target, key) {
      const exist = proxied[key];
      if (exist) {
        return exist;
      }
      const service = target[key];
      if (service) {
        // I don't think this actually has to get done every
        // time because we're setting the prop on the REAL
        // object, but it's so cheap that I'm leaving it simple.
        const newProxy = new Proxy(service, clientHandler);
        newProxy[CallPathPropertyKey] = key;
        proxied[key] = newProxy;
        return newProxy;
      }
      return service;
    },
  };

  return new Proxy(serviceCollection, collectionProxy);
}
