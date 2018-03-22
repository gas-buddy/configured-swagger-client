import tap from 'tap';
import nock from 'nock';
import * as clientConfig from '../src/index';

let services;

const basePetstoreUrl = 'http://petstore.swagger.io';
const swaggerPath = '/v2/swagger.json';


function nockGetPet(petId) {
  nock(basePetstoreUrl)
    .get(`/v2/pet/${petId}`)
    .reply(200, {
      id: petId,
    });
}

tap.test('Client should work', async (t) => {
  nock(basePetstoreUrl)
    .get(swaggerPath)
    .reply(200,
      // eslint-disable-next-line global-require
      require('./data/petswagger.json'));

  nockGetPet(1);

  services = await clientConfig.configureServices({
    pets: `${basePetstoreUrl}${swaggerPath}`,
  });
  const pets = await services.Pets.apis.pet.getPetById({ petId: 1 });
  t.strictEquals(pets.status, 200, 'Should find pets');
  t.ok(pets.obj, 'Should return an obj');
});

tap.test('Client should support interception', async (t) => {
  t.plan(1);
  nockGetPet(1);
  await services.Pets.apis.pet.getPetById({ petId: 1 }, {
    requestInterceptor: function intercept() {
      t.ok(true, 'Should call interceptor');
      return this;
    },
  });
});

tap.test('Client should support proxy', async (t) => {
  t.plan(4);
  nockGetPet(1);
  const proxied = clientConfig.servicesWithOptions(services, {
    requestInterceptor: function intercept() {
      t.ok(true, 'Should call interceptor');
      return this;
    },
  });
  const res = await proxied.Pets.pet.getPetById({ petId: 1 });
  t.strictEquals(res.status, 200, 'Should return 200');
  t.ok(res.obj.id, 'Should have an id');
  t.ok(!proxied.Pets.apis.pet.doesNotExist, 'Should return null for non-existent method');
});

tap.test('Client should allow convenient exception handling', async (t) => {
  t.plan(1);
  try {
    nock(basePetstoreUrl)
      .get('/v2/pet/2')
      .reply(404);
    const proxied = clientConfig.servicesWithOptions(services);
    const { status } = await proxied.Pets.apis.pet.getPetById({ petId: 2 }).expect(404);
    t.strictEquals(status, 404, 'should get a 404 status');
  } catch (error) {
    t.fail('Should not throw for expected error');
  }
});
