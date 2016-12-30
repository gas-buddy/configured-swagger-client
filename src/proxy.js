function chainInterceptors(defaultOptions, explicitOptions) {
  const combined = Object.assign({}, defaultOptions, explicitOptions);
  if (defaultOptions && explicitOptions) {
    ['requestInterceptor', 'responseInterceptor']
      .forEach((m) => {
        if (defaultOptions[m] && explicitOptions[m]) {
          combined[m] = function combinedInterceptor(...args) {
            explicitOptions[m].apply(this, args);
            defaultOptions[m].apply(this, args);
          };
        }
      });
  }
  return combined;
}

export default function servicesWithOptions(serviceCollection, options) {
  // This proxy function is used for each API on each service
  const apiHandler = {
    get(target, key) {
      if (target.apis[key]) {
        return (params, explicitOptions) => {
          let defaultOptions = options;
          if (typeof options === 'function') {
            defaultOptions = options(key, params, explicitOptions);
          }
          return target[key](params, chainInterceptors(defaultOptions, explicitOptions));
        };
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
