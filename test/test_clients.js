import tap from 'tap';
import * as clientConfig from '../src/index';

let services;

tap.test('Client should work', async (t) => {
  services = await clientConfig.configureServices({
    pets: 'http://petstore.swagger.io/v2/swagger.json',
  });
  const pets = await services.Pets.pet.getPetById({ petId: 2 });
  t.strictEquals(pets.status, 200, 'Should find pets');
  t.ok(pets.obj, 'Should return an obj');
});

tap.test('Client should support interception', async (t) => {
  t.plan(1);
  await services.Pets.pet.getPetById({ petId: 2 }, {
    requestInterceptor: function intercept() {
      t.ok(true, 'Should call interceptor');
      return this;
    },
  });
});

tap.test('Client should support proxy', async (t) => {
  t.plan(4);
  const proxied = clientConfig.servicesWithOptions(services, {
    requestInterceptor: function intercept() {
      t.ok(true, 'Should call interceptor');
      return this;
    },
  });
  const res = await proxied.Pets.pet.getPetById({ petId: 2 });
  t.strictEquals(res.status, 200, 'Should return 200');
  t.ok(res.obj.id, 'Should have an id');
  t.ok(!proxied.Pets.pet.doesNotExist, 'Should return null for non-existent method');
});
