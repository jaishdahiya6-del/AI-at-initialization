import { connect, done } from './_db';
import { backfillCity } from '../services/collector';
import { CITIES } from '../utils/cities';
(async () => {
  await connect();
  const days = Number(process.argv[2] ?? 30);
  for (const c of CITIES) {
    try { console.log(`${c.name}: ${await backfillCity(c, days)} hourly rows`); } catch (e: any) { console.error(`${c.name}: ${e.message}`); }
  }
  await done();
})();
