import assert from 'assert';
import configureServices from './configure';

export { configureServices };
export { OriginalCallPropertyKey, servicesWithOptions } from './proxy';

export default class SwaggerClientConfigurator {
  constructor(context, config) {
    this.promise = configureServices(config.specs, config.endpoints, config.options);
  }

  async start() {
    assert(this.promise, 'start called multiple times on configured-postgres-client instance');
    const promise = this.promise;
    delete this.promise;
    return promise;
  }
}
