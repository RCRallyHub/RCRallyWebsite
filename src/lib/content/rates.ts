import { getDb } from '../db';
import { cached } from './cache';

export interface RateData {
  name: string;
  description: string;
  price: string;
  billingUnit: string;
  peakOrOffPeak: string;
  category: string;
  features: string[];
  isPlaceholderPrice: boolean;
  displayOrder: number;
  featured: boolean;
  published: boolean;
}

// `id` mirrors the old Astro `type:'data'` collection entry id (the file's
// slug, e.g. "off-peak-hourly") — rates.astro looks this up directly.
export interface RateEntry {
  id: string;
  data: RateData;
}

async function fetchRates(): Promise<RateEntry[]> {
  const db = getDb();
  const rateRows = (await db.execute('SELECT * FROM rates')).rows;
  const featureRows = (await db.execute('SELECT rate_id, feature FROM rate_features ORDER BY rate_id, sort_order')).rows;

  const featuresByRateId = new Map<number, string[]>();
  for (const f of featureRows) {
    const rateId = Number(f.rate_id);
    if (!featuresByRateId.has(rateId)) featuresByRateId.set(rateId, []);
    featuresByRateId.get(rateId)!.push(String(f.feature));
  }

  return rateRows.map((r) => ({
    id: String(r.slug),
    data: {
      name: String(r.name),
      description: String(r.description),
      price: String(r.price),
      billingUnit: String(r.billing_unit),
      peakOrOffPeak: String(r.peak_or_off_peak),
      category: String(r.category),
      features: featuresByRateId.get(Number(r.id)) ?? [],
      isPlaceholderPrice: !!r.is_placeholder_price,
      displayOrder: Number(r.display_order),
      featured: !!r.featured,
      published: !!r.published,
    },
  }));
}

export function getRates(): Promise<RateEntry[]> {
  return cached('rates', fetchRates);
}
