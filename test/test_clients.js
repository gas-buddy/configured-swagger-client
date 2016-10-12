import tap from 'tap';
import * as clientConfig from '../src/index';

let services;

tap.test('Client should work', async (t) => {
  services = await clientConfig.configureServices({
    pets: 'http://petstore.swagger.io/v2/swagger.json',
  });
  const pets = await services.Pets.pet.findPetsByStatus({
    status: 'pending',
  });
  t.strictEquals(pets.status, 200, 'Should find pets');
  t.ok(pets.obj, 'Should return an obj');
  t.end();
});

tap.test('Client should support interception', async (t) => {
  t.plan(1);
  await services.Pets.pet.findPetsByStatus({ status: 'pending' }, {
    requestInterceptor: function intercept() {
      t.ok(true, 'Should call interceptor');
    },
  });
  t.end();
});

tap.test('Client should support proxy', async (t) => {
  t.plan(1);
  const proxied = clientConfig.servicesWithOptions(services, {
    requestInterceptor: function intercept() {
      t.ok(true, 'Should call interceptor');
    },
  });
  await proxied.Pets.pet.findPetsByStatus({ status: 'pending' });
  t.end();
});
