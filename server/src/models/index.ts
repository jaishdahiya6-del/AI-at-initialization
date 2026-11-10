import mongoose, { Schema } from 'mongoose';

const obs = new Schema({
  city: { type: String, required: true },
  ts: { type: Date, required: true },
  source: { type: String, required: true }, // owm-live | owm-history | import
  temp: Number, feelsLike: Number, humidity: Number, pressure: Number, windSpeed: Number, windDeg: Number,
  clouds: Number, rain: Number, condition: String,
  pm25: Number, pm10: Number, co: Number, no: Number, no2: Number, so2: Number, o3: Number, nh3: Number,
  aqi: Number, dominant: String, uv: Number,
}, { versionKey: false });
obs.index({ city: 1, ts: -1 });
obs.index({ city: 1, ts: 1, source: 1 }, { unique: true });
export const Observation = mongoose.model('Observation', obs);

const user = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  name: String,
  passwordHash: { type: String, required: true },
  savedCities: { type: [String], default: [] },
  favorites: { type: [{ name: String, lat: Number, lon: Number }], default: [] },
  notify: { type: Boolean, default: true },
}, { timestamps: true });
export const User = mongoose.model('User', user);

const alert = new Schema({
  city: String, type: String, severity: { type: String, enum: ['info', 'warning', 'critical'] },
  message: String, value: Number, threshold: Number, read: { type: Boolean, default: false },
}, { timestamps: { createdAt: true, updatedAt: false } });
alert.index({ createdAt: -1 });
alert.index({ city: 1, type: 1, createdAt: -1 });
export const Alert = mongoose.model('Alert', alert);

export const Setting = mongoose.model('Setting', new Schema({ key: { type: String, unique: true }, value: Schema.Types.Mixed }));

const plog = new Schema({
  city: String, target: String, horizon: Number, madeAt: Date, targetTime: Date,
  value: Number, lo: Number, hi: Number, model: String, version: Number,
});
plog.index({ city: 1, target: 1, horizon: 1, madeAt: 1 }, { unique: true });
plog.index({ targetTime: -1 });
export const PredictionLog = mongoose.model('PredictionLog', plog);

const meta = new Schema({
  city: String, target: String, horizon: Number, version: Number, trainedAt: Date,
  status: { type: String, enum: ['ready', 'insufficient_data'] },
  best: String, nTrain: Number, nTest: Number, sigma: Number, beatsPersistence: Boolean,
  metrics: Schema.Types.Mixed,
  note: String,
});
meta.index({ city: 1, target: 1, horizon: 1 }, { unique: true });
export const ModelMeta = mongoose.model('ModelMeta', meta);
