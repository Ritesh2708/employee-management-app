const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');

function buildEmployee(overrides = {}) {
  return {
    name: 'Alice Johnson',
    email: 'alice@example.com',
    department: 'Engineering',
    role: 'Developer',
    hireDate: '2023-05-15',
    ...overrides,
  };
}

test('employee CRUD flow and department/search filters work', async () => {
  const app = createApp({ dbFilePath: ':memory:' });

  const createOne = await request(app).post('/api/employees').send(buildEmployee());
  assert.equal(createOne.statusCode, 201);
  assert.equal(createOne.body.name, 'Alice Johnson');

  const createTwo = await request(app)
    .post('/api/employees')
    .send(buildEmployee({
      name: 'Bob Smith',
      email: 'bob@example.com',
      department: 'HR',
      role: 'Recruiter',
    }));
  assert.equal(createTwo.statusCode, 201);

  const listAll = await request(app).get('/api/employees');
  assert.equal(listAll.statusCode, 200);
  assert.equal(listAll.body.length, 2);

  const filtered = await request(app).get('/api/employees').query({ department: 'Engineering' });
  assert.equal(filtered.statusCode, 200);
  assert.equal(filtered.body.length, 1);
  assert.equal(filtered.body[0].email, 'alice@example.com');

  const searched = await request(app).get('/api/employees').query({ search: 'Recruiter' });
  assert.equal(searched.statusCode, 200);
  assert.equal(searched.body.length, 1);
  assert.equal(searched.body[0].name, 'Bob Smith');

  const updateResponse = await request(app)
    .put(`/api/employees/${createOne.body.id}`)
    .send(buildEmployee({ role: 'Senior Developer' }));
  assert.equal(updateResponse.statusCode, 200);
  assert.equal(updateResponse.body.role, 'Senior Developer');

  const deleteResponse = await request(app).delete(`/api/employees/${createTwo.body.id}`);
  assert.equal(deleteResponse.statusCode, 204);

  const finalList = await request(app).get('/api/employees');
  assert.equal(finalList.statusCode, 200);
  assert.equal(finalList.body.length, 1);

  await app.locals.closeDb();
});

test('returns validation and conflict errors', async () => {
  const app = createApp({ dbFilePath: ':memory:' });

  const badEmailResponse = await request(app).post('/api/employees').send(buildEmployee({ email: 'not-an-email' }));
  assert.equal(badEmailResponse.statusCode, 400);

  const first = await request(app).post('/api/employees').send(buildEmployee());
  assert.equal(first.statusCode, 201);

  const duplicate = await request(app).post('/api/employees').send(buildEmployee({ name: 'Alice Two' }));
  assert.equal(duplicate.statusCode, 409);

  await app.locals.closeDb();
});
