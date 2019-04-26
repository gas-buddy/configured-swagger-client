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
});
