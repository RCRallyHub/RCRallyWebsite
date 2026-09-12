import { getDb } from '../db';
import { cached } from './cache';

// Not currently rendered on any page (mirrors the pre-migration state — the
// `addons` content collection existed but had no reader either); kept for
// completeness and for the portal's future Add-ons screen.
export interface AddonData {
  name: string;
  description?: string;
  price: string;
  unit: string;
  icon: string;
  displayOrder: number;
  published: boolean;
}

export interface AddonEntry {
  id: string;
  data: AddonData;
}

async function fetchAddons(): Promise<AddonEntry[]> {
  const db = getDb();
  const rows = (await db.execute('SELECT * FROM addons')).rows;
  return rows.map((r) => ({
    id: String(r.slug),
    data: {
      name: String(r.name),
      description: r.description ? String(r.description) : undefined,
      price: String(r.price),
      unit: String(r.unit),
      icon: String(r.icon),
      displayOrder: Number(r.display_order),
      published: !!r.published,
    },
  }));
}

export function getAddons(): Promise<AddonEntry[]> {
  return cached('addons', fetchAddons);
}
