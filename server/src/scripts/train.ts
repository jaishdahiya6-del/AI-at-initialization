import { connect, done } from './_db';
import { trainCity } from '../ml/train';
import { CITIES } from '../utils/cities';
(async () => {
  await connect();
  const only = process.argv[2];
  for (const c of CITIES.filter((c) => !only || c.id === only)) {
    const r = await trainCity(c.id);
    console.log(`${c.name}: ${r.filter((x) => x.r).length}/${r.length} models trained`);
  }
  await done();
})().catch((e) => { console.error(e.message); process.exit(1); });
