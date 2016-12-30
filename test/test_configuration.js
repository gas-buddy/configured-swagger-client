import tap from 'tap';
import path from 'path';
import * as clientConfig from '../src/index';
import part1 from './swagger/part1.json';
import sample from './swagger/sample.json';

tap.test('Should work with no services', async (t) => {
  const ret = await clientConfig.configureServices({});
  t.deepEquals(ret, {}, 'Should not return any services');
  t.end();
});

tap.test('Should work with a JSON config', async (t) => {
  const ret = await clientConfig.configureServices({
    test: part1,
  });
  t.ok(ret.Test, 'Should configure the Test service');
  t.ok(ret.Test.default, 'Test service should have a default tag');
  t.ok(ret.Test.default.get_goodbye, 'Test service should have known API');
  t.strictEquals(ret.Test.url, 'https://test:8443', 'Default host should match');
  t.end();
});

tap.test('Should work with an endpoint', async (t) => {
  const ret = await clientConfig.configureServices({
    test: part1,
  }, {
    test: {
      hostname: 'foobar',
      protocol: 'http:',
      port: 1234,
    },
  });
  t.ok(ret.Test, 'Should configure the Test service');
  t.ok(ret.Test.default, 'Test service should have a default tag');
  t.ok(ret.Test.default.get_goodbye, 'Test service should have known API');
  t.strictEquals(ret.Test.url, 'http://foobar:1234', 'Default host should match');
  t.end();
});

tap.test('Should work with a URL', async (t) => {
  const ret = await clientConfig.configureServices({
    pets: 'http://petstore.swagger.io/v2/swagger.json',
  });
  t.ok(ret.Pets, 'Should configure the Pets service');
  t.ok(ret.Pets.pet, 'Pet service should have a pet tag');
  t.ok(ret.Pets.pet.findPetsByStatus, 'Pets service should have known API');
  t.strictEquals(ret.Pets.url, 'http://petstore.swagger.io/v2/swagger.json', 'Default host should match');
  t.end();
});

tap.test('Should work with a composite document', async (t) => {
  const ret = await clientConfig.configureServices({
    test: sample,
  }, {}, { basedir: path.join(__dirname, 'swagger') });
  t.ok(ret.Test, 'Should configure the Test service');
  t.ok(ret.Test.default, 'Test service should have a default tag');
  t.ok(ret.Test.default.get_hello_world, 'Test service should have known API');
  t.strictEquals(ret.Test.url, 'https://test:8443', 'Default host should match');
  t.end();
});

tap.test('Should pre and post process', async (t) => {
  t.plan(7);
  const ret = await clientConfig.configureServices({
    'test-serv': part1,
  }, {}, {
    preProcessor(info) {
      t.strictEquals(info.name, 'test-serv', 'Name should match');
      t.strictEquals(info.memberName, 'TestServ', 'Member name should match');
      t.strictEquals(info.config.url, 'https://test-serv:8443');
    },
    postProcessor(info) {
      t.strictEquals(info.name, 'test-serv', 'Name should match');
      t.strictEquals(info.memberName, 'TestServ', 'Member name should match');
      t.ok(info.client, 'Should have a client');
    },
  });
  t.ok(ret.TestServ, 'Client should be returned');
  t.end();
});

tap.test('Should work from the root module', async (t) => {
  const Constructor = clientConfig.default;
  const c = new Constructor({}, {
    specs: {
      test: part1,
    },
  });
  const final = await c.start();
  t.ok(final.Test, 'Should create services');
});
