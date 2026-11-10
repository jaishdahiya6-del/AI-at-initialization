import request from 'supertest';
import { app } from '../src/app';
describe('api', () => {
  it('health', async () => { const r = await request(app).get('/api/health'); expect(r.status).toBe(200); });
  it('lists 13 cities', async () => { expect((await request(app).get('/api/cities')).body).toHaveLength(13); });
  it('rejects invalid registration', async () => { expect((await request(app).post('/api/auth/register').send({ email: 'x', password: '1' })).status).toBe(400); });
  it('protects training', async () => { expect((await request(app).post('/api/ml/train').send({ city: 'delhi' })).status).toBe(401); });
  it('rejects unknown city', async () => { expect((await request(app).get('/api/current?city=atlantis')).status).toBe(404); });
  it('does not leak stack traces on 404', async () => { const r = await request(app).get('/api/nope'); expect(JSON.stringify(r.body)).not.toMatch(/at /); });
});
