#!/usr/bin/env node
/**
 * HISTORICAL / NON-FUNCTIONAL as of the Sveltia-removal cleanup: its source
 * directory, src/content/*, has been deleted (nothing in the runtime code
 * reads astro:content/getCollection anymore — every page now reads from
 * Turso via src/lib/content/*.ts). This file is kept only as a record of
 * the one-time migration and the src/content -> Turso field mapping it
 * performed; running it today will simply find no source files and do
 * nothing. If the schema ever needs to be re-derived from that original
 * shape, this is the reference.
 *
 * Original header, preserved for context:
 *
 * One-time (idempotent) migration: src/content/* (YAML/Markdown, edited via
 * Sveltia CMS) -> Turso/libSQL (db/schema.sql).
 *
 * Run against the local dev database by default:
 *   node scripts/migrate-to-turso.mjs
 *
 * Run against a real hosted Turso database once one exists, by setting
 * TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in the environment first — the
 * script itself never changes:
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... node scripts/migrate-to-turso.mjs
 *
 * Safe to re-run: every insert is an upsert keyed by a natural key (slug /
 * singleton id), and child rows are fully replaced (delete-then-insert) on
 * each run so re-running never duplicates rows.
 *
 * Validation: every source file is parsed and checked against a Zod schema
 * that mirrors src/content/config.ts field-for-field (config.ts itself can't
 * be imported here — its `defineCollection`/`astro:content` types only exist
 * inside Astro's own build pipeline — so the same shapes are reproduced
 * below using the standalone `zod` package that already ships as an Astro
 * dependency).
 */

import { createClient } from '@libsql/client';
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import yaml from 'js-yaml';
import matter from 'gray-matter';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'src', 'content');

// ---------------------------------------------------------------------------
// DB connection (same env-driven rule as src/lib/db.ts; duplicated here in
// plain JS since this script runs standalone via `node`, not through Astro/TS)
// ---------------------------------------------------------------------------
function openDb() {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!url || url.startsWith('file:')) {
    const dbDir = path.join(ROOT, 'db');
    if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });
    return createClient({ url: url || `file:${path.join(dbDir, 'local.db')}` });
  }
  if (!authToken) {
    throw new Error('TURSO_DATABASE_URL is set but TURSO_AUTH_TOKEN is missing.');
  }
  return createClient({ url, authToken });
}

// ---------------------------------------------------------------------------
// Zod schemas mirroring src/content/config.ts
// ---------------------------------------------------------------------------
const dateString = z
  .union([z.string(), z.date()])
  .transform((val) => (val instanceof Date ? val.toISOString().slice(0, 10) : val));

const ctaSchema = z.object({
  label: z.string(),
  href: z.string(),
  style: z.enum(['primary', 'secondary', 'ghost']).default('primary'),
});

const seoShape = {
  seoTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogImage: z.string().optional(),
};

const settingsSchema = z.object({
  businessName: z.string(),
  tagline: z.string().optional(),
  logo: z.string(),
  favicon: z.string().optional(),
  address: z.string(),
  locationDescription: z.string(),
  operatingHours: z.string(),
  operatingHoursStart: z.string(),
  operatingHoursEnd: z.string(),
  contact: z.object({
    mobile: z.string(),
    mobileIsDummy: z.boolean().default(true),
    email: z.string(),
    emailIsDummy: z.boolean().default(true),
    facebook: z.string(),
    facebookIsDummy: z.boolean().default(true),
    messenger: z.string().optional(),
    mapEmbedUrl: z.string().optional(),
    mapUrl: z.string().optional(),
  }),
  social: z
    .object({
      facebook: z.string().optional(),
      instagram: z.string().optional(),
      tiktok: z.string().optional(),
      youtube: z.string().optional(),
    })
    .optional(),
  announcementBar: z
    .object({
      enabled: z.boolean().default(false),
      message: z.string().optional(),
      link: z.string().optional(),
    })
    .optional(),
  bookingButtonText: z.string().default('Book a Court'),
  bookingUrl: z.string().default('https://your-booking-system.example.com/book'),
  footer: z
    .object({
      description: z.string().optional(),
      copyrightName: z.string().optional(),
    })
    .optional(),
  defaultSeo: z.object(seoShape).optional(),
});

const pageSchema = z.object({
  title: z.string(),
  heading: z.string(),
  subheading: z.string().optional(),
  description: z.string().optional(),
  heroImage: z.string().optional(),
  heroImageAlt: z.string().optional(),
  ctas: z.array(ctaSchema).optional(),
  published: z.boolean().default(true),
  ...seoShape,
});

const rateSchema = z.object({
  name: z.string(),
  description: z.string(),
  price: z.string(),
  billingUnit: z.string().default('per hour'),
  peakOrOffPeak: z.enum(['peak', 'off-peak', 'both', 'n/a']).default('n/a'),
  category: z.enum([
    'court-rental', 'equipment', 'coaching', 'open-play', 'group',
    'tournament', 'corporate', 'private-event',
  ]),
  features: z.array(z.string()).default([]),
  isPlaceholderPrice: z.boolean().default(true),
  displayOrder: z.number().default(0),
  featured: z.boolean().default(false),
  published: z.boolean().default(true),
});

const eventSchema = z.object({
  title: z.string(),
  image: z.string(),
  imageAlt: z.string().optional(),
  excerpt: z.string(),
  date: dateString,
  startTime: z.string(),
  endTime: z.string(),
  registrationDeadline: dateString.optional(),
  category: z.enum([
    "Men's Doubles", "Women's Doubles", 'Mixed Doubles', 'Beginner Division',
    'Intermediate Division', 'Open Division', 'All-Male Open Play', 'Clinic',
    'Open Play', 'Community',
  ]),
  skillLevel: z.string().default('All Levels'),
  fee: z.string(),
  maxParticipants: z.number().optional(),
  availableSlots: z.number().optional(),
  format: z.string().optional(),
  rules: z.string().optional(),
  prizes: z.string().optional(),
  registrationLink: z.string().optional(),
  status: z.enum(['Upcoming', 'Registration Open', 'Registration Closed', 'Ongoing', 'Completed', 'Cancelled']),
  featured: z.boolean().default(false),
  published: z.boolean().default(true),
});

const gallerySchema = z.object({
  image: z.string(),
  thumbnail: z.string().optional(),
  title: z.string(),
  caption: z.string().optional(),
  alt: z.string(),
  category: z.enum([
    'Court', 'Casual Games', "Men's Doubles", "Women's Doubles", 'Mixed Doubles',
    'Open Play', 'Tournaments', 'Families', 'Community', 'Awarding', 'Private Events',
  ]),
  date: dateString.optional(),
  displayOrder: z.number().default(0),
  featured: z.boolean().default(false),
  published: z.boolean().default(true),
});

const videoSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  facebookReelUrl: z.string(),
  approvedEmbedUrl: z.string(),
  posterImage: z.string(),
  posterImageAlt: z.string().optional(),
  category: z.string().default('Highlights'),
  date: dateString.optional(),
  displayOrder: z.number().default(0),
  featured: z.boolean().default(false),
  published: z.boolean().default(true),
});

const testimonialSchema = z.object({
  customerName: z.string(),
  customerType: z.string(),
  avatar: z.string().optional(),
  rating: z.number().min(1).max(5).default(5),
  testimonial: z.string(),
  displayOrder: z.number().default(0),
  featured: z.boolean().default(false),
  published: z.boolean().default(true),
});

const faqSchema = z.object({
  question: z.string(),
  answer: z.string(),
  category: z.enum(['Booking', 'Rates & Payment', 'Venue & Hours', 'Rules & Policies', 'Events', 'Equipment']),
  displayOrder: z.number().default(0),
  published: z.boolean().default(true),
  useAsChatbotAnswer: z.boolean().default(true),
});

const addonSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  price: z.string(),
  unit: z.string().default('per session'),
  icon: z.string().default('paddle'),
  displayOrder: z.number().default(0),
  published: z.boolean().default(true),
});

const chatbotSchema = z.object({
  enabled: z.boolean().default(true),
  chatbotName: z.string().default('Rally Assistant'),
  greeting: z.string(),
  fallbackMessage: z.string(),
  notificationDelaySeconds: z.number().default(4),
  quickReplies: z.array(z.object({ label: z.string(), intent: z.string() })),
  bookingLink: z.string().default('/book'),
  contactActions: z.array(
    z.object({
      label: z.string(),
      type: z.enum(['call', 'email', 'facebook', 'contact-form', 'link']),
      value: z.string(),
    })
  ),
});

const homeContentSchema = z.object({
  highlights: z.array(z.object({ icon: z.string().default('court'), title: z.string(), description: z.string() })),
  whyChooseUs: z.array(
    z.object({
      icon: z.string().default('check'),
      title: z.string(),
      description: z.string(),
      isPlaceholder: z.boolean().default(false),
    })
  ),
  stats: z.array(
    z.object({
      label: z.string(),
      value: z.number(),
      suffix: z.string().default('+'),
      isDummy: z.boolean().default(true),
    })
  ),
  bookingSteps: z.array(z.object({ step: z.number(), title: z.string(), description: z.string() })),
});

const aboutContentSchema = z.object({
  values: z.array(z.object({ title: z.string(), description: z.string() })),
  team: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      photo: z.string().optional(),
      isPlaceholder: z.boolean().default(true),
    })
  ),
  partners: z.array(z.object({ name: z.string(), description: z.string().optional(), logo: z.string().optional() })),
});

const policySchema = z.object({
  title: z.string(),
  lastUpdated: dateString.optional(),
  published: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------
function slugFromFilename(filename) {
  return path.basename(filename).replace(/\.(yml|yaml|md|markdown)$/i, '');
}

function readYamlDir(collectionName, schema) {
  const dir = path.join(CONTENT_DIR, collectionName);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.ya?ml$/i.test(f))
    .map((f) => {
      const raw = readFileSync(path.join(dir, f), 'utf8');
      const data = yaml.load(raw);
      const parsed = schema.parse(data);
      return { slug: slugFromFilename(f), data: parsed };
    });
}

function readSingleYaml(collectionName, filename, schema) {
  const file = path.join(CONTENT_DIR, collectionName, filename);
  const raw = readFileSync(file, 'utf8');
  return schema.parse(yaml.load(raw));
}

function readMarkdownDir(collectionName, schema) {
  const dir = path.join(CONTENT_DIR, collectionName);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.md$/i.test(f))
    .map((f) => {
      const raw = readFileSync(path.join(dir, f), 'utf8');
      const { data: frontmatter, content } = matter(raw);
      const parsed = schema.parse(frontmatter);
      return { slug: slugFromFilename(f), data: parsed, body: content.trim() };
    });
}

const b = (v) => (v ? 1 : 0); // boolean -> 0/1 for SQLite

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------
async function main() {
  const db = openDb();
  const now = Math.floor(Date.now() / 1000);
  let summary = [];

  await db.execute('PRAGMA foreign_keys = ON');

  // --- business_settings + social_links -------------------------------------------------
  {
    const s = readSingleYaml('settings', 'settings.yml', settingsSchema);
    await db.execute({
      sql: `INSERT INTO business_settings (
              id, business_name, tagline, logo_url, favicon_url, address, location_description,
              operating_hours, operating_hours_start, operating_hours_end,
              contact_mobile, contact_mobile_is_dummy, contact_email, contact_email_is_dummy,
              contact_facebook, contact_facebook_is_dummy, contact_messenger, map_embed_url, map_url,
              announcement_enabled, announcement_message, announcement_link,
              booking_button_text, booking_url, footer_description, footer_copyright_name,
              default_seo_title, default_seo_meta_description, default_seo_og_image, updated_at
            ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              business_name=excluded.business_name, tagline=excluded.tagline, logo_url=excluded.logo_url,
              favicon_url=excluded.favicon_url, address=excluded.address, location_description=excluded.location_description,
              operating_hours=excluded.operating_hours, operating_hours_start=excluded.operating_hours_start,
              operating_hours_end=excluded.operating_hours_end, contact_mobile=excluded.contact_mobile,
              contact_mobile_is_dummy=excluded.contact_mobile_is_dummy, contact_email=excluded.contact_email,
              contact_email_is_dummy=excluded.contact_email_is_dummy, contact_facebook=excluded.contact_facebook,
              contact_facebook_is_dummy=excluded.contact_facebook_is_dummy, contact_messenger=excluded.contact_messenger,
              map_embed_url=excluded.map_embed_url, map_url=excluded.map_url,
              announcement_enabled=excluded.announcement_enabled, announcement_message=excluded.announcement_message,
              announcement_link=excluded.announcement_link, booking_button_text=excluded.booking_button_text,
              booking_url=excluded.booking_url, footer_description=excluded.footer_description,
              footer_copyright_name=excluded.footer_copyright_name, default_seo_title=excluded.default_seo_title,
              default_seo_meta_description=excluded.default_seo_meta_description,
              default_seo_og_image=excluded.default_seo_og_image, updated_at=excluded.updated_at`,
      args: [
        s.businessName, s.tagline ?? null, s.logo, s.favicon ?? null, s.address, s.locationDescription,
        s.operatingHours, s.operatingHoursStart, s.operatingHoursEnd,
        s.contact.mobile, b(s.contact.mobileIsDummy), s.contact.email, b(s.contact.emailIsDummy),
        s.contact.facebook, b(s.contact.facebookIsDummy), s.contact.messenger ?? null,
        s.contact.mapEmbedUrl ?? null, s.contact.mapUrl ?? null,
        b(s.announcementBar?.enabled), s.announcementBar?.message ?? null, s.announcementBar?.link ?? null,
        s.bookingButtonText, s.bookingUrl, s.footer?.description ?? null, s.footer?.copyrightName ?? null,
        s.defaultSeo?.seoTitle ?? null, s.defaultSeo?.metaDescription ?? null, s.defaultSeo?.ogImage ?? null, now,
      ],
    });

    const socials = Object.entries(s.social ?? {}).filter(([, url]) => !!url);
    await db.execute('DELETE FROM social_links');
    for (const [i, [platform, url]] of socials.entries()) {
      await db.execute({
        sql: `INSERT INTO social_links (platform, url, sort_order, enabled, created_at, updated_at)
              VALUES (?, ?, ?, 1, ?, ?)`,
        args: [platform, url, i, now, now],
      });
    }
    summary.push(`business_settings: 1 row, social_links: ${socials.length} rows`);
  }

  // --- pages (+ page_ctas) ---------------------------------------------------------------
  {
    const pages = readMarkdownDir('pages', pageSchema);
    for (const [i, p] of pages.entries()) {
      const result = await db.execute({
        sql: `INSERT INTO pages (
                slug, title, heading, subheading, description, hero_image_url, hero_image_alt,
                body, seo_title, meta_description, og_image_url, published, sort_order, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(slug) DO UPDATE SET
                title=excluded.title, heading=excluded.heading, subheading=excluded.subheading,
                description=excluded.description, hero_image_url=excluded.hero_image_url,
                hero_image_alt=excluded.hero_image_alt, body=excluded.body, seo_title=excluded.seo_title,
                meta_description=excluded.meta_description, og_image_url=excluded.og_image_url,
                published=excluded.published, sort_order=excluded.sort_order, updated_at=excluded.updated_at
              RETURNING id`,
        args: [
          p.slug, p.data.title, p.data.heading, p.data.subheading ?? null, p.data.description ?? null,
          p.data.heroImage ?? null, p.data.heroImageAlt ?? null, p.body || null, p.data.seoTitle ?? null,
          p.data.metaDescription ?? null, p.data.ogImage ?? null, b(p.data.published), i, now, now,
        ],
      });
      const pageId = Number(result.rows[0].id);
      await db.execute({ sql: 'DELETE FROM page_ctas WHERE page_id = ?', args: [pageId] });
      for (const [ci, cta] of (p.data.ctas ?? []).entries()) {
        await db.execute({
          sql: 'INSERT INTO page_ctas (page_id, label, href, style, sort_order) VALUES (?, ?, ?, ?, ?)',
          args: [pageId, cta.label, cta.href, cta.style, ci],
        });
      }
    }
    summary.push(`pages: ${pages.length} rows`);
  }

  // --- homeContent -> page_sections/section_items (attached to pages.slug='home') --------
  {
    const home = readSingleYaml('homeContent', 'home.yml', homeContentSchema);
    const homePage = await db.execute({ sql: 'SELECT id FROM pages WHERE slug = ?', args: ['home'] });
    if (homePage.rows.length === 0) throw new Error('pages row for slug "home" must exist before migrating homeContent');
    const homePageId = Number(homePage.rows[0].id);

    const homeSections = [
      { key: 'highlights', items: home.highlights.map((h) => ({ icon: h.icon, title: h.title, description: h.description })) },
      { key: 'why-choose-us', items: home.whyChooseUs.map((h) => ({ icon: h.icon, title: h.title, description: h.description, is_placeholder: h.isPlaceholder })) },
      { key: 'stats', items: home.stats.map((s) => ({ title: s.label, value_number: s.value, value_suffix: s.suffix, is_placeholder: s.isDummy })) },
      { key: 'booking-steps', items: home.bookingSteps.map((s) => ({ step_number: s.step, title: s.title, description: s.description })) },
    ];
    await upsertPageSections(db, homePageId, homeSections, now);
    summary.push(`page_sections (home): ${homeSections.length}, section_items: ${homeSections.reduce((n, s) => n + s.items.length, 0)}`);
  }

  // --- aboutContent -> page_sections/section_items (attached to pages.slug='about') -------
  {
    const about = readSingleYaml('aboutContent', 'about.yml', aboutContentSchema);
    const aboutPage = await db.execute({ sql: 'SELECT id FROM pages WHERE slug = ?', args: ['about'] });
    if (aboutPage.rows.length === 0) throw new Error('pages row for slug "about" must exist before migrating aboutContent');
    const aboutPageId = Number(aboutPage.rows[0].id);

    const aboutSections = [
      { key: 'values', items: about.values.map((v) => ({ title: v.title, description: v.description })) },
      { key: 'team', items: about.team.map((t) => ({ name: t.name, role: t.role, image_url: t.photo ?? null, is_placeholder: t.isPlaceholder })) },
      { key: 'partners', items: about.partners.map((p) => ({ name: p.name, description: p.description ?? null, image_url: p.logo ?? null })) },
    ];
    await upsertPageSections(db, aboutPageId, aboutSections, now);
    summary.push(`page_sections (about): ${aboutSections.length}, section_items: ${aboutSections.reduce((n, s) => n + s.items.length, 0)}`);
  }

  // --- navigation_items (derived from Header.astro / Footer.astro) -----------------------
  {
    const headerLinks = [
      { label: 'Home', href: '/' },
      { label: 'Book a Court', href: '/book' },
      { label: 'Rates', href: '/rates' },
      { label: 'Events', href: '/events' },
      { label: 'Gallery', href: '/gallery' },
      { label: 'Videos', href: '/videos' },
      { label: 'About', href: '/about' },
      { label: 'FAQs', href: '/faqs' },
      { label: 'Contact', href: '/contact' },
    ];
    const footerColumns = [
      {
        group: 'Explore',
        links: [
          { label: 'Home', href: '/' },
          { label: 'Rates & Packages', href: '/rates' },
          { label: 'Tournaments & Events', href: '/events' },
          { label: 'Gallery', href: '/gallery' },
          { label: 'Videos', href: '/videos' },
        ],
      },
      {
        group: 'Support',
        links: [
          { label: 'FAQs', href: '/faqs' },
          { label: 'Contact Us', href: '/contact' },
          { label: 'Cancellation & Rescheduling', href: '/cancellation-policy' },
          { label: 'Terms & Conditions', href: '/terms' },
          { label: 'Privacy Policy', href: '/privacy' },
        ],
      },
    ];

    await db.execute('DELETE FROM navigation_items');
    let sort = 0;
    for (const link of headerLinks) {
      await db.execute({
        sql: `INSERT INTO navigation_items (label, href, location, group_label, sort_order, enabled, created_at, updated_at)
              VALUES (?, ?, 'header', NULL, ?, 1, ?, ?)`,
        args: [link.label, link.href, sort++, now, now],
      });
    }
    sort = 0;
    for (const col of footerColumns) {
      for (const link of col.links) {
        await db.execute({
          sql: `INSERT INTO navigation_items (label, href, location, group_label, sort_order, enabled, created_at, updated_at)
                VALUES (?, ?, 'footer', ?, ?, 1, ?, ?)`,
          args: [link.label, link.href, col.group, sort++, now, now],
        });
      }
    }
    summary.push(`navigation_items: ${headerLinks.length + footerColumns.reduce((n, c) => n + c.links.length, 0)} rows`);
  }

  // --- rates (+ rate_features) ------------------------------------------------------------
  {
    const rates = readYamlDir('rates', rateSchema);
    for (const r of rates) {
      const result = await db.execute({
        sql: `INSERT INTO rates (
                slug, name, description, price, billing_unit, peak_or_off_peak, category,
                is_placeholder_price, display_order, featured, published, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(slug) DO UPDATE SET
                name=excluded.name, description=excluded.description, price=excluded.price,
                billing_unit=excluded.billing_unit, peak_or_off_peak=excluded.peak_or_off_peak,
                category=excluded.category, is_placeholder_price=excluded.is_placeholder_price,
                display_order=excluded.display_order, featured=excluded.featured,
                published=excluded.published, updated_at=excluded.updated_at
              RETURNING id`,
        args: [
          r.slug, r.data.name, r.data.description, r.data.price, r.data.billingUnit, r.data.peakOrOffPeak,
          r.data.category, b(r.data.isPlaceholderPrice), r.data.displayOrder, b(r.data.featured), b(r.data.published), now, now,
        ],
      });
      const rateId = Number(result.rows[0].id);
      await db.execute({ sql: 'DELETE FROM rate_features WHERE rate_id = ?', args: [rateId] });
      for (const [i, feature] of r.data.features.entries()) {
        await db.execute({
          sql: 'INSERT INTO rate_features (rate_id, feature, sort_order) VALUES (?, ?, ?)',
          args: [rateId, feature, i],
        });
      }
    }
    summary.push(`rates: ${rates.length} rows`);
  }

  // --- events -------------------------------------------------------------------------
  {
    const events = readMarkdownDir('events', eventSchema);
    for (const e of events) {
      await db.execute({
        sql: `INSERT INTO events (
                slug, title, image_url, image_alt, excerpt, body, event_date, start_time, end_time,
                registration_deadline, category, skill_level, fee, max_participants, available_slots,
                format, rules, prizes, registration_link, status, featured, published, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(slug) DO UPDATE SET
                title=excluded.title, image_url=excluded.image_url, image_alt=excluded.image_alt,
                excerpt=excluded.excerpt, body=excluded.body, event_date=excluded.event_date,
                start_time=excluded.start_time, end_time=excluded.end_time,
                registration_deadline=excluded.registration_deadline, category=excluded.category,
                skill_level=excluded.skill_level, fee=excluded.fee, max_participants=excluded.max_participants,
                available_slots=excluded.available_slots, format=excluded.format, rules=excluded.rules,
                prizes=excluded.prizes, registration_link=excluded.registration_link, status=excluded.status,
                featured=excluded.featured, published=excluded.published, updated_at=excluded.updated_at`,
        args: [
          e.slug, e.data.title, e.data.image, e.data.imageAlt ?? null, e.data.excerpt, e.body || null,
          e.data.date, e.data.startTime, e.data.endTime, e.data.registrationDeadline ?? null, e.data.category,
          e.data.skillLevel, e.data.fee, e.data.maxParticipants ?? null, e.data.availableSlots ?? null,
          e.data.format ?? null, e.data.rules ?? null, e.data.prizes ?? null, e.data.registrationLink ?? null,
          e.data.status, b(e.data.featured), b(e.data.published), now, now,
        ],
      });
    }
    summary.push(`events: ${events.length} rows`);
  }

  // --- gallery_sections + gallery_images ------------------------------------------------
  {
    const images = readYamlDir('gallery', gallerySchema);
    const categories = [...new Set(images.map((img) => img.data.category))];
    const sectionIdByCategory = new Map();
    for (const [i, category] of categories.entries()) {
      const result = await db.execute({
        sql: `INSERT INTO gallery_sections (title, sort_order, enabled, created_at, updated_at)
              VALUES (?, ?, 1, ?, ?)
              ON CONFLICT(title) DO UPDATE SET updated_at=excluded.updated_at
              RETURNING id`,
        args: [category, i, now, now],
      });
      sectionIdByCategory.set(category, Number(result.rows[0].id));
    }

    for (const img of images) {
      await db.execute({
        sql: `INSERT INTO gallery_images (
                slug, section_id, image_url, thumbnail_url, title, caption, alt, image_date,
                display_order, featured, published, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(slug) DO UPDATE SET
                section_id=excluded.section_id, image_url=excluded.image_url, thumbnail_url=excluded.thumbnail_url,
                title=excluded.title, caption=excluded.caption, alt=excluded.alt, image_date=excluded.image_date,
                display_order=excluded.display_order, featured=excluded.featured, published=excluded.published,
                updated_at=excluded.updated_at`,
        args: [
          img.slug, sectionIdByCategory.get(img.data.category), img.data.image, img.data.thumbnail ?? null,
          img.data.title, img.data.caption ?? null, img.data.alt, img.data.date ?? null, img.data.displayOrder,
          b(img.data.featured), b(img.data.published), now, now,
        ],
      });
    }
    summary.push(`gallery_sections: ${categories.length} rows, gallery_images: ${images.length} rows`);
  }

  // --- videos -------------------------------------------------------------------------
  {
    const videos = readYamlDir('videos', videoSchema);
    for (const v of videos) {
      await db.execute({
        sql: `INSERT INTO videos (
                slug, title, description, facebook_reel_url, approved_embed_url, poster_image_url,
                poster_image_alt, category, video_date, display_order, featured, published, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(slug) DO UPDATE SET
                title=excluded.title, description=excluded.description, facebook_reel_url=excluded.facebook_reel_url,
                approved_embed_url=excluded.approved_embed_url, poster_image_url=excluded.poster_image_url,
                poster_image_alt=excluded.poster_image_alt, category=excluded.category, video_date=excluded.video_date,
                display_order=excluded.display_order, featured=excluded.featured, published=excluded.published,
                updated_at=excluded.updated_at`,
        args: [
          v.slug, v.data.title, v.data.description ?? null, v.data.facebookReelUrl, v.data.approvedEmbedUrl,
          v.data.posterImage, v.data.posterImageAlt ?? null, v.data.category, v.data.date ?? null,
          v.data.displayOrder, b(v.data.featured), b(v.data.published), now, now,
        ],
      });
    }
    summary.push(`videos: ${videos.length} rows`);
  }

  // --- testimonials ---------------------------------------------------------------------
  {
    const testimonials = readYamlDir('testimonials', testimonialSchema);
    for (const t of testimonials) {
      await db.execute({
        sql: `INSERT INTO testimonials (
                slug, customer_name, customer_type, avatar_url, rating, testimonial,
                display_order, featured, published, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(slug) DO UPDATE SET
                customer_name=excluded.customer_name, customer_type=excluded.customer_type,
                avatar_url=excluded.avatar_url, rating=excluded.rating, testimonial=excluded.testimonial,
                display_order=excluded.display_order, featured=excluded.featured, published=excluded.published,
                updated_at=excluded.updated_at`,
        args: [
          t.slug, t.data.customerName, t.data.customerType, t.data.avatar ?? null, t.data.rating,
          t.data.testimonial, t.data.displayOrder, b(t.data.featured), b(t.data.published), now, now,
        ],
      });
    }
    summary.push(`testimonials: ${testimonials.length} rows`);
  }

  // --- faqs -----------------------------------------------------------------------------
  {
    const faqs = readYamlDir('faqs', faqSchema);
    for (const f of faqs) {
      await db.execute({
        sql: `INSERT INTO faqs (
                slug, question, answer, category, display_order, published, use_as_chatbot_answer, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(slug) DO UPDATE SET
                question=excluded.question, answer=excluded.answer, category=excluded.category,
                display_order=excluded.display_order, published=excluded.published,
                use_as_chatbot_answer=excluded.use_as_chatbot_answer, updated_at=excluded.updated_at`,
        args: [
          f.slug, f.data.question, f.data.answer, f.data.category, f.data.displayOrder,
          b(f.data.published), b(f.data.useAsChatbotAnswer), now, now,
        ],
      });
    }
    summary.push(`faqs: ${faqs.length} rows`);
  }

  // --- addons -----------------------------------------------------------------------------
  {
    const addons = readYamlDir('addons', addonSchema);
    for (const a of addons) {
      await db.execute({
        sql: `INSERT INTO addons (
                slug, name, description, price, unit, icon, display_order, published, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(slug) DO UPDATE SET
                name=excluded.name, description=excluded.description, price=excluded.price, unit=excluded.unit,
                icon=excluded.icon, display_order=excluded.display_order, published=excluded.published,
                updated_at=excluded.updated_at`,
        args: [a.slug, a.data.name, a.data.description ?? null, a.data.price, a.data.unit, a.data.icon, a.data.displayOrder, b(a.data.published), now, now],
      });
    }
    summary.push(`addons: ${addons.length} rows`);
  }

  // --- policies ---------------------------------------------------------------------------
  {
    const policies = readMarkdownDir('policies', policySchema);
    for (const p of policies) {
      await db.execute({
        sql: `INSERT INTO policies (slug, title, last_updated, body, published, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(slug) DO UPDATE SET
                title=excluded.title, last_updated=excluded.last_updated, body=excluded.body,
                published=excluded.published, updated_at=excluded.updated_at`,
        args: [p.slug, p.data.title, p.data.lastUpdated ?? null, p.body || null, b(p.data.published), now, now],
      });
    }
    summary.push(`policies: ${policies.length} rows`);
  }

  // --- chatbot_settings + quick replies + contact actions --------------------------------
  {
    const c = readSingleYaml('chatbot', 'chatbot.yml', chatbotSchema);
    await db.execute({
      sql: `INSERT INTO chatbot_settings (
              id, enabled, chatbot_name, greeting, fallback_message, notification_delay_seconds, booking_link, updated_at
            ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              enabled=excluded.enabled, chatbot_name=excluded.chatbot_name, greeting=excluded.greeting,
              fallback_message=excluded.fallback_message, notification_delay_seconds=excluded.notification_delay_seconds,
              booking_link=excluded.booking_link, updated_at=excluded.updated_at`,
      args: [b(c.enabled), c.chatbotName, c.greeting, c.fallbackMessage, c.notificationDelaySeconds, c.bookingLink, now],
    });
    await db.execute('DELETE FROM chatbot_quick_replies');
    for (const [i, qr] of c.quickReplies.entries()) {
      await db.execute({
        sql: 'INSERT INTO chatbot_quick_replies (label, intent, sort_order) VALUES (?, ?, ?)',
        args: [qr.label, qr.intent, i],
      });
    }
    await db.execute('DELETE FROM chatbot_contact_actions');
    for (const [i, ca] of c.contactActions.entries()) {
      await db.execute({
        sql: 'INSERT INTO chatbot_contact_actions (label, type, value, sort_order) VALUES (?, ?, ?, ?)',
        args: [ca.label, ca.type, ca.value, i],
      });
    }
    summary.push(`chatbot_settings: 1 row, quick_replies: ${c.quickReplies.length}, contact_actions: ${c.contactActions.length}`);
  }

  console.log('\nMigration complete:\n' + summary.map((s) => '  - ' + s).join('\n'));
  db.close?.();
}

async function upsertPageSections(db, pageId, sections, now) {
  for (const [si, section] of sections.entries()) {
    const result = await db.execute({
      sql: `INSERT INTO page_sections (page_id, section_key, sort_order, enabled, created_at, updated_at)
            VALUES (?, ?, ?, 1, ?, ?)
            ON CONFLICT(page_id, section_key) DO UPDATE SET sort_order=excluded.sort_order, updated_at=excluded.updated_at
            RETURNING id`,
      args: [pageId, section.key, si, now, now],
    });
    const sectionId = Number(result.rows[0].id);
    await db.execute({ sql: 'DELETE FROM section_items WHERE section_id = ?', args: [sectionId] });
    for (const [ii, item] of section.items.entries()) {
      await db.execute({
        sql: `INSERT INTO section_items (
                section_id, sort_order, enabled, icon, name, role, title, description,
                value_number, value_suffix, step_number, image_url, is_placeholder, created_at, updated_at
              ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          sectionId, ii, item.icon ?? null, item.name ?? null, item.role ?? null, item.title ?? null,
          item.description ?? null, item.value_number ?? null, item.value_suffix ?? null,
          item.step_number ?? null, item.image_url ?? null, b(item.is_placeholder), now, now,
        ],
      });
    }
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exitCode = 1;
});
