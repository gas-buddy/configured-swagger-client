export const OriginalCallPropertyKey =
  Symbol('An error object that is created at original call time for a Swagger call');

function chainInterceptors(defaultOptions, explicitOptions, placeholderError) {
  const combined = Object.assign({}, defaultOptions, explicitOptions);
  if (defaultOptions && explicitOptions) {
    ['requestInterceptor', 'responseInterceptor']
      .forEach((m) => {
        if (defaultOptions[m] && explicitOptions[m]) {
          combined[m] = function combinedInterceptor(...args) {
            this[OriginalCallPropertyKey] = placeholderError;
            explicitOptions[m].apply(this, args);
            defaultOptions[m].apply(this, args);
          };
        }
      });
  }
  return combined;
}

export function servicesWithOptions(serviceCollection, options) {
  // This proxy function is used for each API on each service
  const apiHandler = {
    get(target, key) {
      if (target.apis[key]) {
        const returnFunction = (params, explicitOptions) => {
          const placeholderError = new Error();
          Error.captureStackTrace(placeholderError, returnFunction);
          let defaultOptions = options;
          if (typeof options === 'function') {
            defaultOptions = options(key, params, explicitOptions);
          }
          // Provide a convenience method on the promise
          const finalOptions = chainInterceptors(defaultOptions, explicitOptions, placeholderError);
          return Object.assign(
            target[key](params, finalOptions), {
              expect(...codes) {
                return this.catch((error) => {
                  if (codes.includes(error.status)) {
                    return error;
                  }
                  throw error;
                });
              },
            });
        };
        return returnFunction;
      }
      return target[key];
    },
  };

  // This proxy function is used for each service
  const serviceHandler = {
    get(target, key) {
      if (target[key] && target.apis[key]) {
        return new Proxy(target[key], apiHandler);
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
        return new Proxy(service, serviceHandler);
      }
      return service;
    },
  };

  return new Proxy(serviceCollection, collectionProxy);
}
