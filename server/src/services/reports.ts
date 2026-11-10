import PDFDocument from 'pdfkit';
import { ModelMeta } from '../models';
import { getRange, aggregate, stats, toCsv } from './history';
import { predictCity } from '../ml/predict';
import { getCity } from '../utils/cities';

export type ReportType = 'daily' | 'weekly' | 'monthly' | 'comparison' | 'prediction';
const DAYS: Record<string, number> = { daily: 1, weekly: 7, monthly: 30, comparison: 7, prediction: 7 };
const SOURCE = 'Data: OpenWeatherMap (weather + air pollution), OpenUV (UV). AQI: instant CPCB-method estimate.';

function chart(doc: PDFKit.PDFDocument, title: string, pts: (number | null)[], color = '#ea580c') {
  const x0 = doc.x, y0 = doc.y + 14, w = 480, h = 90, v = pts.filter((p): p is number => p !== null);
  doc.fontSize(10).fillColor('#111').text(title);
  if (v.length < 2) { doc.fillColor('#666').text('Not enough data to chart.'); doc.moveDown(); return; }
  const mx = Math.max(...v), mn = Math.min(...v), rg = mx - mn || 1;
  doc.rect(x0, y0, w, h).strokeColor('#bbb').stroke();
  let started = false;
  pts.forEach((p, i) => { if (p === null) return; const X = x0 + (i / (pts.length - 1)) * w, Y = y0 + h - ((p - mn) / rg) * h; started ? doc.lineTo(X, Y) : doc.moveTo(X, Y); started = true; });
  doc.strokeColor(color).lineWidth(1.5).stroke().lineWidth(1);
  doc.fillColor('#666').fontSize(8).text(`max ${mx.toFixed(1)}  min ${mn.toFixed(1)}`, x0, y0 + h + 3);
  doc.y = y0 + h + 22; doc.x = x0;
}

export async function buildReport(type: ReportType, cityIds: string[], format: 'csv' | 'pdf') {
  const to = new Date(), from = new Date(+to - DAYS[type] * 86400_000);
  const cities = cityIds.map((id) => getCity(id)).filter(Boolean) as NonNullable<ReturnType<typeof getCity>>[];
  if (!cities.length) throw Object.assign(new Error('Unknown city'), { status: 400 });
  const data = await Promise.all(cities.map(async (c) => ({ c, docs: await getRange(c.id, from, to) })));
  if (format === 'csv') return { mime: 'text/csv', body: Buffer.from(toCsv(data.flatMap((d) => d.docs))) };

  const doc = new PDFDocument({ margin: 50 }); const chunks: Buffer[] = [];
  doc.on('data', (b) => chunks.push(b));
  const end = new Promise<Buffer>((r) => doc.on('end', () => r(Buffer.concat(chunks))));
  doc.fontSize(20).fillColor('#9a3412').text(`AI Atmosphere Intelligence: ${type[0].toUpperCase() + type.slice(1)} report`);
  doc.fontSize(10).fillColor('#444').text(`Location: ${cities.map((c) => c.name).join(', ')}`)
    .text(`Range: ${from.toISOString().slice(0, 16)}Z to ${to.toISOString().slice(0, 16)}Z`).text(`Generated: ${to.toISOString()}`).moveDown();
  for (const { c, docs } of data) {
    const s = await stats(c.id, from, to, docs);
    const last = [...docs].reverse().find((d: any) => d.aqi !== undefined);
    doc.fontSize(14).fillColor('#111').text(c.name);
    doc.fontSize(10).text(`Samples: ${s.samples} | Avg AQI: ${s.avgAqi ?? 'n/a'} | Highest day: ${s.highestDay ? `${s.highestDay.aqi} (${s.highestDay.date.slice(0, 10)})` : 'n/a'} | Lowest day: ${s.lowestDay ? `${s.lowestDay.aqi} (${s.lowestDay.date.slice(0, 10)})` : 'n/a'} | Change vs previous period: ${s.changePct ?? 'n/a'}%`);
    if (last) doc.text(`Last observation: ${new Date(last.ts).toISOString()} | AQI ${last.aqi} | PM2.5 ${last.pm25?.toFixed?.(1) ?? 'n/a'} | PM10 ${last.pm10?.toFixed?.(1) ?? 'n/a'} | Temp ${last.temp ?? 'n/a'}°C`);
    doc.moveDown(0.5);
    const rows = aggregate(docs, type === 'daily' ? 'hour' : 'day');
    chart(doc, 'PM2.5 (µg/m³)', rows.map((r) => r.pm25));
    chart(doc, 'AQI (instant CPCB-method)', rows.map((r) => r.aqi), '#dc2626');
    if (type === 'prediction') {
      const p = await predictCity(c.id, false);
      const metas = await ModelMeta.find({ city: c.id }).sort({ target: 1, horizon: 1 }).lean();
      doc.fontSize(12).text('ML predictions (own model)');
      doc.fontSize(9).text(p.stale ? 'Input data is stale; predictions withheld.' : p.horizons.map((h: any) => `+${h.horizon}h: PM2.5 ${h.pm25.status === 'ready' ? `${h.pm25.value} [${h.pm25.lo}-${h.pm25.hi}]` : h.pm25.status}, PM10 ${h.pm10.status === 'ready' ? h.pm10.value : h.pm10.status}`).join('\n'));
      doc.moveDown(0.5).fontSize(12).text('Model evaluation (chronological hold-out)');
      doc.fontSize(9).text(metas.length ? metas.map((m: any) => `${m.target} +${m.horizon}h: ${m.status === 'ready' ? `${m.best} MAE ${m.metrics[m.best].mae}, RMSE ${m.metrics[m.best].rmse}, R² ${m.metrics[m.best].r2}; persistence RMSE ${m.metrics.persistence.rmse}` : m.note}`).join('\n') : 'No models trained yet.');
    }
    doc.moveDown();
  }
  doc.fontSize(8).fillColor('#666').text(SOURCE).text('Informational only; not a medical diagnostic document.');
  doc.end();
  return { mime: 'application/pdf', body: await end };
}
