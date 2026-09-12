import { getDb } from '../db';
import { cached } from './cache';

export interface EventData {
  title: string;
  image: string;
  imageAlt?: string;
  excerpt: string;
  date: string;
  startTime: string;
  endTime: string;
  registrationDeadline?: string;
  category: string;
  skillLevel: string;
  fee: string;
  maxParticipants?: number;
  availableSlots?: number;
  format?: string;
  rules?: string;
  prizes?: string;
  registrationLink?: string;
  status: string;
  featured: boolean;
  published: boolean;
}

export interface EventEntry {
  slug: string;
  data: EventData;
  body: string;
}

function rowToEvent(row: Record<string, unknown>): EventEntry {
  return {
    slug: String(row.slug),
    body: row.body ? String(row.body) : '',
    data: {
      title: String(row.title),
      image: String(row.image_url),
      imageAlt: row.image_alt ? String(row.image_alt) : undefined,
      excerpt: String(row.excerpt),
      date: String(row.event_date),
      startTime: String(row.start_time),
      endTime: String(row.end_time),
      registrationDeadline: row.registration_deadline ? String(row.registration_deadline) : undefined,
      category: String(row.category),
      skillLevel: String(row.skill_level),
      fee: String(row.fee),
      maxParticipants: row.max_participants != null ? Number(row.max_participants) : undefined,
      availableSlots: row.available_slots != null ? Number(row.available_slots) : undefined,
      format: row.format ? String(row.format) : undefined,
      rules: row.rules ? String(row.rules) : undefined,
      prizes: row.prizes ? String(row.prizes) : undefined,
      registrationLink: row.registration_link ? String(row.registration_link) : undefined,
      status: String(row.status),
      featured: !!row.featured,
      published: !!row.published,
    },
  };
}

async function fetchEvents(): Promise<EventEntry[]> {
  const db = getDb();
  const rows = (await db.execute('SELECT * FROM events')).rows;
  return rows.map((r) => rowToEvent(r as Record<string, unknown>));
}

async function fetchEventBySlug(slug: string): Promise<EventEntry | undefined> {
  const db = getDb();
  const row = (await db.execute({ sql: 'SELECT * FROM events WHERE slug = ?', args: [slug] })).rows[0];
  return row ? rowToEvent(row as Record<string, unknown>) : undefined;
}

/** All events (published + unpublished) — callers filter/sort as the old `getCollection('events')` results were. */
export function getEvents(): Promise<EventEntry[]> {
  return cached('events', fetchEvents);
}

export function getEventBySlug(slug: string): Promise<EventEntry | undefined> {
  return cached(`event:${slug}`, () => fetchEventBySlug(slug));
}
