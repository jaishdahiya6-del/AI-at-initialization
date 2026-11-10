// Usage: npm run import:csv -w server -- ../datasets/file.csv delhi
// CSV header must include: timestamp (ISO or unix seconds) and any of pm25,pm10,no2,so2,co,o3,temp,humidity,pressure,windSpeed,rain
import fs from 'fs';
import { connect, done } from './_db';
import { Observation } from '../models';
import { computeAqi } from '../utils/aqi';
(async () => {
  const [file, city] = process.argv.slice(2);
  if (!file || !city) throw new Error('usage: import:csv <file.csv> <cityId>');
  const [head, ...lines] = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const cols = head.split(',').map((s) => s.trim());
  await connect();
  const ops: any[] = [];
  for (const l of lines) {
    const v = l.split(',');
    const r: any = {}; cols.forEach((c, i) => { const n = Number(v[i]); r[c] = c === 'timestamp' ? v[i] : v[i] === '' || Number.isNaN(n) ? undefined : n; });
    const ts = /^\d+$/.test(r.timestamp) ? new Date(Number(r.timestamp) * 1000) : new Date(r.timestamp);
    if (Number.isNaN(+ts)) continue;
    const { timestamp, ...rest } = r;
    const a = computeAqi(rest);
    const set = Object.fromEntries(Object.entries({ ...rest, aqi: a?.aqi, dominant: a?.dominant }).filter(([, x]) => x !== undefined));
    ops.push({ updateOne: { filter: { city, ts, source: 'import' }, update: { $set: set }, upsert: true } });
  }
  for (let i = 0; i < ops.length; i += 1000) await Observation.bulkWrite(ops.slice(i, i + 1000), { ordered: false });
  console.log(`imported ${ops.length} rows for ${city}`);
  await done();
})().catch((e) => { console.error(e.message); process.exit(1); });
