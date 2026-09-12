-- RC Rally Hub — Turso (libSQL) schema
--
-- Replaces the Sveltia-CMS-edited YAML/Markdown content collections
-- (src/content/*) as the single source of truth for site content.
-- One table per content type (not one JSON blob) so the admin portal
-- can present real forms/lists per content type.
--
-- Conventions:
--   * every table has integer PK `id`, `created_at`, `updated_at` (unix seconds)
--   * ordering via `sort_order` / `display_order` (kept name-compatible with
--     the existing `displayOrder` field where the source data already had one)
--   * visibility via `enabled` / `published` (matches existing field names)
--   * every `*_url` / `*_image` column holds either an existing static
--     `/images/...` path (untouched, still served from the filesystem) or a
--     `/media/<id>` URL pointing at a row in the `media` table (portal uploads)
--
-- Safe to re-run: every CREATE TABLE is IF NOT EXISTS, so this file can be
-- applied against a fresh local libSQL file or a fresh hosted Turso database.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Auth
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  token      TEXT NOT NULL UNIQUE,
  user_id    INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_id ON admin_sessions(user_id);

-- ---------------------------------------------------------------------------
-- Media — portal-uploaded / replaced images only, stored as blobs.
-- Existing static images under public/images/* are NOT migrated in here;
-- they stay referenced as plain file paths across every table below.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  data       BLOB NOT NULL,
  mime_type  TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width      INTEGER,
  height     INTEGER,
  alt_text   TEXT,
  caption    TEXT,
  title      TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ---------------------------------------------------------------------------
-- Pages (was: src/content/pages/*.md — 13 entries: home, book, rates,
-- events, gallery, videos, about, faqs, contact, privacy, terms,
-- cancellation-policy, 404)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pages (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  slug              TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,
  heading           TEXT NOT NULL,
  subheading        TEXT,
  description       TEXT,
  hero_image_url    TEXT,
  hero_image_alt    TEXT,
  body              TEXT,               -- markdown body below the front-matter
  seo_title         TEXT,
  meta_description  TEXT,
  og_image_url      TEXT,
  published         INTEGER NOT NULL DEFAULT 1,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Each page's call-to-action buttons (pages.ctas[])
CREATE TABLE IF NOT EXISTS page_ctas (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id    INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  href       TEXT NOT NULL,
  style      TEXT NOT NULL DEFAULT 'primary', -- primary|secondary|ghost
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_page_ctas_page_id ON page_ctas(page_id);

-- Generic repeatable-card sections belonging to a page (was:
-- src/content/homeContent/home.yml + src/content/aboutContent/about.yml).
-- section_key identifies which block it is: 'highlights' | 'why-choose-us' |
-- 'stats' | 'booking-steps' (home) and 'values' | 'team' | 'partners' (about).
CREATE TABLE IF NOT EXISTS page_sections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id     INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  title       TEXT,
  subtitle    TEXT,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(page_id, section_key)
);

-- The repeatable cards inside a page_section. Wide/generic on purpose: the
-- source shapes vary a lot (icon+title+description, name+role+photo,
-- label+value+suffix, step+title+description, ...) and every field below is
-- nullable so one table covers all of them without a card-type-specific table.
CREATE TABLE IF NOT EXISTS section_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id    INTEGER NOT NULL REFERENCES page_sections(id) ON DELETE CASCADE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  enabled       INTEGER NOT NULL DEFAULT 1,
  icon          TEXT,      -- highlights, whyChooseUs
  name          TEXT,      -- team, partners
  role          TEXT,      -- team
  title         TEXT,      -- highlights, whyChooseUs, bookingSteps, values
  description   TEXT,      -- highlights, whyChooseUs, bookingSteps, values, partners
  value_number  REAL,      -- stats.value
  value_suffix  TEXT,      -- stats.suffix
  step_number   INTEGER,   -- bookingSteps.step
  image_url     TEXT,      -- team.photo, partners.logo
  is_placeholder INTEGER NOT NULL DEFAULT 0, -- whyChooseUs/team.isPlaceholder, stats.isDummy
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_section_items_section_id ON section_items(section_id);

-- ---------------------------------------------------------------------------
-- Navigation (new — was hardcoded in Header.astro / Footer.astro)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS navigation_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  label       TEXT NOT NULL,
  href        TEXT NOT NULL,
  location    TEXT NOT NULL,       -- 'header' | 'footer'
  group_label TEXT,                -- footer column title, e.g. "Explore" / "Support"; null for header
  sort_order  INTEGER NOT NULL DEFAULT 0,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_navigation_items_location ON navigation_items(location);

-- ---------------------------------------------------------------------------
-- Business settings (was: src/content/settings/settings.yml — single row)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_settings (
  id                        INTEGER PRIMARY KEY CHECK (id = 1), -- singleton row
  business_name             TEXT NOT NULL,
  tagline                   TEXT,
  logo_url                  TEXT NOT NULL,
  favicon_url               TEXT,
  address                   TEXT NOT NULL,
  location_description      TEXT NOT NULL,
  operating_hours           TEXT NOT NULL,
  operating_hours_start     TEXT NOT NULL,
  operating_hours_end       TEXT NOT NULL,
  contact_mobile            TEXT NOT NULL,
  contact_mobile_is_dummy   INTEGER NOT NULL DEFAULT 1,
  contact_email             TEXT NOT NULL,
  contact_email_is_dummy    INTEGER NOT NULL DEFAULT 1,
  contact_facebook          TEXT NOT NULL,
  contact_facebook_is_dummy INTEGER NOT NULL DEFAULT 1,
  contact_messenger         TEXT,
  map_embed_url             TEXT,
  map_url                   TEXT,
  announcement_enabled      INTEGER NOT NULL DEFAULT 0,
  announcement_message      TEXT,
  announcement_link         TEXT,
  booking_button_text       TEXT NOT NULL DEFAULT 'Book a Court',
  booking_url               TEXT NOT NULL,
  footer_description        TEXT,
  footer_copyright_name     TEXT,
  default_seo_title             TEXT,
  default_seo_meta_description  TEXT,
  default_seo_og_image          TEXT,
  updated_at                INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS social_links (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  platform   TEXT NOT NULL,  -- facebook | instagram | tiktok | youtube
  url        TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled    INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ---------------------------------------------------------------------------
-- Rates & Packages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rates (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  slug                  TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  description           TEXT NOT NULL,
  price                 TEXT NOT NULL,
  billing_unit          TEXT NOT NULL DEFAULT 'per hour',
  peak_or_off_peak      TEXT NOT NULL DEFAULT 'n/a',
  category              TEXT NOT NULL,
  is_placeholder_price  INTEGER NOT NULL DEFAULT 1,
  display_order         INTEGER NOT NULL DEFAULT 0,
  featured              INTEGER NOT NULL DEFAULT 0,
  published             INTEGER NOT NULL DEFAULT 1,
  created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at            INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS rate_features (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  rate_id    INTEGER NOT NULL REFERENCES rates(id) ON DELETE CASCADE,
  feature    TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rate_features_rate_id ON rate_features(rate_id);

-- ---------------------------------------------------------------------------
-- Events (Tournaments & Events)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  slug                   TEXT NOT NULL UNIQUE,
  title                  TEXT NOT NULL,
  image_url              TEXT NOT NULL,
  image_alt              TEXT,
  excerpt                TEXT NOT NULL,
  body                   TEXT,          -- markdown description below front-matter
  event_date             TEXT NOT NULL, -- "YYYY-MM-DD"
  start_time             TEXT NOT NULL, -- "HH:MM"
  end_time               TEXT NOT NULL,
  registration_deadline  TEXT,
  category               TEXT NOT NULL,
  skill_level            TEXT NOT NULL DEFAULT 'All Levels',
  fee                    TEXT NOT NULL,
  max_participants       INTEGER,
  available_slots        INTEGER,
  format                 TEXT,
  rules                  TEXT,
  prizes                 TEXT,
  registration_link      TEXT,
  status                 TEXT NOT NULL,
  featured               INTEGER NOT NULL DEFAULT 0,
  published              INTEGER NOT NULL DEFAULT 1,
  created_at             INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at             INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ---------------------------------------------------------------------------
-- Gallery — categories become a real, portal-editable table instead of a
-- hardcoded enum, so a new category doesn't need a code change.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gallery_sections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL UNIQUE, -- e.g. "Court", "Mixed Doubles", "Community"
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS gallery_images (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  slug           TEXT NOT NULL UNIQUE, -- original filename stem, kept for idempotent re-import
  section_id     INTEGER NOT NULL REFERENCES gallery_sections(id) ON DELETE RESTRICT,
  image_url      TEXT NOT NULL,
  thumbnail_url  TEXT,
  title          TEXT NOT NULL,
  caption        TEXT,
  alt            TEXT NOT NULL,
  image_date     TEXT,
  display_order  INTEGER NOT NULL DEFAULT 0,
  featured       INTEGER NOT NULL DEFAULT 0,
  published      INTEGER NOT NULL DEFAULT 1,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_gallery_images_section_id ON gallery_images(section_id);

-- ---------------------------------------------------------------------------
-- Videos (Facebook Reel embeds)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS videos (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  slug               TEXT NOT NULL UNIQUE,
  title              TEXT NOT NULL,
  description        TEXT,
  facebook_reel_url  TEXT NOT NULL,
  approved_embed_url TEXT NOT NULL,
  poster_image_url   TEXT NOT NULL,
  poster_image_alt   TEXT,
  category           TEXT NOT NULL DEFAULT 'Highlights',
  video_date         TEXT,
  display_order      INTEGER NOT NULL DEFAULT 0,
  featured           INTEGER NOT NULL DEFAULT 0,
  published          INTEGER NOT NULL DEFAULT 1,
  created_at         INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at         INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ---------------------------------------------------------------------------
-- Testimonials, FAQs, Add-ons, Policies
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS testimonials (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  slug           TEXT NOT NULL UNIQUE,
  customer_name  TEXT NOT NULL,
  customer_type  TEXT NOT NULL,
  avatar_url     TEXT,
  rating         INTEGER NOT NULL DEFAULT 5,
  testimonial    TEXT NOT NULL,
  display_order  INTEGER NOT NULL DEFAULT 0,
  featured       INTEGER NOT NULL DEFAULT 0,
  published      INTEGER NOT NULL DEFAULT 1,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS faqs (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  slug                   TEXT NOT NULL UNIQUE,
  question               TEXT NOT NULL,
  answer                 TEXT NOT NULL,
  category               TEXT NOT NULL,
  display_order          INTEGER NOT NULL DEFAULT 0,
  published              INTEGER NOT NULL DEFAULT 1,
  use_as_chatbot_answer  INTEGER NOT NULL DEFAULT 1,
  created_at             INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at             INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS addons (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT,
  price         TEXT NOT NULL,
  unit          TEXT NOT NULL DEFAULT 'per session',
  icon          TEXT NOT NULL DEFAULT 'paddle',
  display_order INTEGER NOT NULL DEFAULT 0,
  published     INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS policies (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  last_updated TEXT,
  body         TEXT,
  published    INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ---------------------------------------------------------------------------
-- Chatbot (was: src/content/chatbot/chatbot.yml — single row + two lists)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chatbot_settings (
  id                          INTEGER PRIMARY KEY CHECK (id = 1), -- singleton row
  enabled                     INTEGER NOT NULL DEFAULT 1,
  chatbot_name                TEXT NOT NULL DEFAULT 'Rally Assistant',
  greeting                    TEXT NOT NULL,
  fallback_message            TEXT NOT NULL,
  notification_delay_seconds  INTEGER NOT NULL DEFAULT 4,
  booking_link                TEXT NOT NULL DEFAULT '/book',
  updated_at                  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS chatbot_quick_replies (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  label      TEXT NOT NULL,
  intent     TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chatbot_contact_actions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  label      TEXT NOT NULL,
  type       TEXT NOT NULL, -- call | email | facebook | contact-form | link
  value      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
