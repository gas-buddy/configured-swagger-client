import tap from 'tap';
import nock from 'nock';
import { EventEmitter } from 'events';
import Client from '../src/index';
import FeatureApi from './swagger';

const service = new EventEmitter();

const client = new Client({ service }, {
  clients: {
    'feature-api': FeatureApi,
  },
  endpoints: {
    'feature-api': {
      protocol: 'http',
      port: 1234,
    },
  },
});

class DerivativeApi extends FeatureApi {
  constructor(config) {
    super(config(DerivativeApi));
  }
}

service.serviceFactory = client.start({ service });
service.name = 'test-serv';
const featureApi = new FeatureApi(service.serviceFactory);

const fakeRequest = { app: { id: 'GasBuddy' } };

tap.test('test_clients', async (tester) => {
  tester.test('simple call', async (t) => {
    nock('http://feature-api:1234')
      .post('/feature/features/foobar', { app: { id: 'GasBuddy' } })
      .reply(200, {});

    const response = await featureApi.getFeatures({
      tag: 'foobar',
      client: fakeRequest,
    });
    t.strictEquals(response.status, 200, 'Should find pets');
    t.ok(response.body, 'Should return a body');
  });

  tester.test('interception', async (t) => {
    t.plan(2);
    nock('http://feature-api:1234')
      .post('/feature/features/foobar', { app: { id: 'GasBuddy' } })
      .reply(200, {});
    await featureApi.getFeatures({
      tag: 'foobar',
      client: fakeRequest,
    }, {
      requestInterceptor() {
        t.ok(true, 'Should call request interceptor');
      },
      responseInterceptor() {
        t.ok(true, 'Should call response interceptor');
      },
    });
  });

  tester.test('exception handling should work', async (t) => {
    nock('http://feature-api:1234')
      .post('/feature/features/baz', { app: { id: 'GasBuddy' } })
      .reply(404, {});

    t.plan(3);
    client.once('error', () => {
      t.ok('Should call error event handler');
    });
    const { status } = await featureApi.getFeatures({
      tag: 'baz',
      client: fakeRequest,
    }).expect(404);
    t.ok(true, 'Should not throw for expected error');
    t.strictEquals(status, 404, 'Should return 404');
  });

  tester.test('Incorrect service factory should throw', (t) => {
    t.throws(() => new DerivativeApi(service.serviceFactory), 'Unknown service should throw');
    t.end();
  });

  tester.test('HTTPS should work with logging', async (t) => {
    const secureClientLogger = new Client({ service }, {
      clients: {
        'feature-api': FeatureApi,
      },
      endpoints: {
        'feature-api': {
          protocol: 'https',
          log: true,
        },
      },
    });
    service.serviceFactory = secureClientLogger.start({ service });
    const secureApi = new FeatureApi(service.serviceFactory);

    nock('https://feature-api:8443')
      .post('/feature/features/foobar', { app: { id: 'GasBuddy' } })
      .reply(200, {});

    const response = await secureApi.getFeatures({
      tag: 'foobar',
      client: fakeRequest,
    });

    t.strictEquals(response.status, 200, 'Should get a 200');
  });

  tester.test('Timeouts should work', async (t) => {
    nock('http://feature-api:1234')
      .post('/feature/features/timeout', { app: { id: 'GasBuddy' } })
      .delay({ head: 100 })
      .reply(200, {});

    const response = await featureApi.getFeatures({
      tag: 'timeout',
      client: fakeRequest,
    }, { timeout: 10 }).catch(e => e);
    t.strictEquals(response.type, 'aborted', 'Should get an aborted error');
  });
});
