# RC Rally Hub by Garahe — Website

The official multi-page website for **RC Rally Hub by Garahe**, a covered pickleball venue inside Garahe by Chef Rods Restaurant in Pala-o, Iligan City, Philippines. Built with [Astro](https://astro.build) (server-rendered), TypeScript, and Tailwind CSS, content-managed through a custom **admin portal** (`/portal`) backed by a **Turso (libSQL)** database, and deployed on [Netlify](https://www.netlify.com).

Content edits made in the portal go live immediately — no git commit, no Netlify rebuild. Real-time booking (availability, double-booking prevention, admin approval) is handled by a separate booking system that every "Book Now" link on this site points to; see [Booking System (Separate Project)](#booking-system-separate-project).

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Local Development](#local-development)
4. [Content Model & The Single Source of Truth](#content-model--the-single-source-of-truth)
5. [Editing Content With the Admin Portal](#editing-content-with-the-admin-portal)
6. [Admin Portal Setup & Authentication](#admin-portal-setup--authentication)
7. [Common Editing Tasks](#common-editing-tasks)
8. [The Midnight-Crossing Booking Schedule](#the-midnight-crossing-booking-schedule)
9. [Deploying to Netlify](#deploying-to-netlify)
10. [Netlify Forms](#netlify-forms)
11. [Booking System (Separate Project)](#booking-system-separate-project)
12. [Chatbot ("Rally Assistant")](#chatbot-rally-assistant)
13. [SEO & Structured Data](#seo--structured-data)
14. [Accessibility](#accessibility)
15. [Environment Variables](#environment-variables)
16. [Troubleshooting](#troubleshooting)
17. [Final Quality Checklist](#final-quality-checklist)

---

## Tech Stack

| Purpose | Choice |
|---|---|
| Framework | [Astro 5](https://astro.build) (`output: 'server'`, SSR via `@astrojs/netlify`, directory-style URLs) |
| Language | TypeScript |
| Styling | Tailwind CSS v3 (custom brand theme in `tailwind.config.mjs`) |
| Content | Turso (libSQL) — a relational schema (`db/schema.sql`) read at request time through `src/lib/content/*.ts` |
| Admin | Custom `/portal` admin UI — session-cookie auth (`admin_users`/`admin_sessions`), no external CMS |
| Carousels | [Swiper](https://swiperjs.com) (testimonials, featured videos) |
| Animation | [GSAP](https://gsap.com) (hero entrance) + CSS/IntersectionObserver scroll-reveal |
| Forms | Netlify Forms (progressively enhanced with `fetch()`) |
| Hosting | Netlify (SSR via `@astrojs/netlify` + Netlify Forms) |
| Sitemap | `@astrojs/sitemap` |

## Project Structure

```
rc-rally-hub/
├── astro.config.mjs        # Astro config (site URL, integrations)
├── tailwind.config.mjs      # Brand colors, fonts, animations
├── netlify.toml              # Build settings, redirects, headers, CSP
├── .env.example               # Documented placeholder env vars
├── db/
│   ├── schema.sql              # Full Turso/libSQL schema (source of truth for table shapes)
│   └── local.db                 # Local dev database file (gitignored)
├── public/
│   ├── images/                # Logo, photos, favicons — existing static assets, untouched
│   ├── robots.txt, site.webmanifest
├── scripts/
│   ├── migrate-to-turso.mjs      # One-time (now historical) src/content -> Turso migration
│   ├── sync-local-to-turso.mjs   # Copies db/local.db's real content into a production Turso DB
│   ├── create-admin-user.mjs     # Create/update a portal login (bcrypt-hashed password)
│   └── verify-booking-time.mjs   # Automated check for the midnight-crossing logic
├── src/
│   ├── components/portal/       # Shared portal UI (FlashBanner, SimpleCrudScreen, …)
│   ├── layouts/
│   │   ├── Layout.astro             # Base HTML shell for the public site
│   │   └── PortalLayout.astro       # Admin portal shell (sidebar, topbar, flash messages)
│   ├── lib/
│   │   ├── db.ts                    # Turso/libSQL client (env-driven: local file vs. hosted Turso)
│   │   ├── auth.ts                  # Session-cookie auth (bcrypt + server-validated tokens)
│   │   ├── storage.ts                # Image BLOB storage in Turso (`media` table) + /media/[id]
│   │   ├── content/                  # Server-side data-access layer (one file per content type)
│   │   ├── portal/simple-crud.ts     # Generic CRUD engine shared by most portal screens
│   │   ├── booking-time.ts          # Core midnight-crossing time-slot logic
│   │   └── client/                  # Client-side scripts (chatbot.ts)
│   ├── middleware.ts             # Guards /portal/* and /api/admin/*
│   ├── components/              # Reusable Astro components (Header, Footer, cards, forms…)
│   │   └── home/                    # Home-page-only section components
│   ├── pages/
│   │   ├── portal/                  # Admin portal screens (login, dashboard, business-info, …)
│   │   ├── api/admin/                # Login/logout endpoints
│   │   ├── media/[id].ts             # Serves BLOB-stored images from Turso
│   │   └── ...                        # The public, file-based routes (the 15 required pages)
│   └── styles/global.css
```

All content that used to live under `src/content/*` (YAML/Markdown, edited via Sveltia) now lives in Turso, edited through `/portal`. `db/schema.sql` is the current source of truth for what fields exist on each content type.

## Local Development

Requires **Node.js 18.17+** (Node 20/22 recommended).

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:4321`. By default it connects to a local libSQL file at `db/local.db` (created automatically, gitignored) — no Turso account is needed for local development. The admin portal is at `http://localhost:4321/portal`; create your first login with:

```bash
node scripts/create-admin-user.mjs <username> [password]
```

(omit the password to have one generated and printed once). See [Admin Portal Setup & Authentication](#admin-portal-setup--authentication) for how this differs in production.

Other scripts:

```bash
npm run build             # astro check + full static build to dist/
npm run preview           # serve the built dist/ locally, like production
npm run verify:booking-time   # run the automated midnight-crossing assertions
```

## Content Model & The Single Source of Truth

Every editable piece of content lives in Turso, in a relational schema defined in `db/schema.sql` and read at request time through `src/lib/content/*.ts`. Nothing is hardcoded into components — all business info, copy, rates, events, gallery items, videos, testimonials, FAQs, and chatbot text are pulled from the database on every request (subject to the short in-memory cache described in [Caching](#editing-content-with-the-admin-portal)).

**The `business_settings` table (edited from the portal's *Business Info* screen) is the single source of truth** for:

- Business name, tagline, logo, favicon
- Address & location description
- Operating hours (both the human-readable string and the `HH:mm` values used by the booking system)
- Contact details — mobile, email, Facebook, Messenger — **each with an `...IsDummy: true` flag**. These are currently placeholder values (`0917 555 7288`, `play@rcrallyhub.com`, `facebook.com/RCRallyHub`). Replace them with real details and flip the matching `IsDummy` flag to `false` and the "(DUMMY)" badge next to them on the Contact page and footer disappears automatically.
- Social links, the announcement bar, footer text, and default SEO title/description/share image

Change something here once and it updates everywhere it's used (header, footer, contact page, chatbot answers, structured data, etc.) — you never need to hunt for a second place to edit hours or an address.

## Editing Content With the Admin Portal

Open **`https://your-site.netlify.app/portal`** and log in (see auth setup below). The sidebar has one screen per content type:

- 🏓 **Business Info** — identity, location & hours, contact, map, announcement bar, booking URL, footer, social links, default SEO
- 📄 **Pages** — per-page hero heading/subheading/meta/body for each of the 13 CMS-driven routes, plus each page's call-to-action buttons (edit-only — pages themselves aren't added/removed here)
- 🧭 **Navigation** — header and footer menu items, grouped and reorderable
- 🖼️ **Gallery** — sections (categories) and photos within them, with upload, captions, alt text, and display order
- 💰 **Rates & Packages** — one entry per package/rate card (with its feature list), with an `is_placeholder_price` flag
- 🏆 **Tournaments & Events** — listing + full detail per event, with status/category
- 🎬 **Videos** — Facebook video entries; only the pre-generated `facebook.com/plugins/video.php` **Approved Embed URL** is ever rendered (see [Chatbot](#chatbot-rally-assistant) note on safety below)
- 💬 **Testimonials** — customer quotes shown in the homepage carousel
- ❓ **FAQs** — question/answer/category, plus a "use as chatbot answer" toggle
- 🎾 **Add-ons** — optional extras shown on the rates page's cost estimator
- 📜 **Policies** — Privacy, Terms, and Cancellation & Rescheduling body text (edit-only)

All fields have labels appropriate to their type (text/textarea/URL/toggle/image picker/reorder) — no code editing or raw JSON is required for day-to-day content updates. Images can be uploaded directly (stored as BLOBs in Turso) or left as an existing static `/images/...` path.

**Not yet portal-editable**: the Home and About pages' repeatable card sections (highlights, why-choose-us, animated stats, booking steps, values, team, partners) — these still need a direct database edit or a future portal screen; the Pages list flags this on-screen.

**Caching**: public pages read through a short in-memory TTL cache in front of Turso, so a portal save appears on the live site within seconds — no git commit, no Netlify rebuild.

## Admin Portal Setup & Authentication

Logins live in the `admin_users` table (bcrypt-hashed passwords) and sessions in `admin_sessions` (an opaque random token, `httpOnly`/`sameSite=lax`/`secure`-in-production cookie, server-validated on every request against the database — revoke access at any time by deleting the session row).

1. Create (or reset) a login with `node scripts/create-admin-user.mjs <username> [password]` — run it with `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` set in the environment to target your production database, or unset to target the local dev file.
2. Visit `https://your-site.netlify.app/portal/login` and sign in.
3. `src/middleware.ts` guards every `/portal/*` and `/api/admin/*` route — an unauthenticated visitor is redirected to the login page (or gets a `401` for API routes).

There is no external OAuth provider or third-party auth dependency — everything above lives in this repo's own database.

## Common Editing Tasks

**Update hours or address** → Portal: *Business Info*. If hours change, also update the operating-hours start/end fields (24-hour `HH:mm`) — these drive the booking time-slot generator.

**Replace the dummy phone/email/Facebook** → Portal: *Business Info → Contact*, update the value and switch off the matching "is dummy/placeholder" toggle.

**Add/edit a rate package** → Portal: *Rates & Packages*. Prices are plain display text (e.g. `"Starting at ₱250 per hour"`) — set `is_placeholder_price` to off once real pricing is confirmed.

**Add a tournament/event** → Portal: *Tournaments & Events*. Set `status` (Upcoming / Registration Open / etc.) and `featured` to control homepage visibility.

**Add gallery photos** → Portal: *Gallery*, open a section, use "Add a Photo". Upload the image (stored in Turso) or paste a path/URL, and always fill in the **Alt Text** field for accessibility.

**Add a video** → Portal: *Videos*. You need the video's **embed URL**, generated at Facebook's [Video Plugin tool](https://developers.facebook.com/docs/plugins/embedded-video-player) — paste the resulting `https://www.facebook.com/plugins/video.php?...` URL into "Approved Embed URL". Any other domain is silently ignored by `VideoCarousel.astro` for security (see below).

**Update testimonials** → Portal: *Testimonials*. Add, remove, or reorder freely.

**Update FAQs / chatbot answers** → Portal: *FAQs*. Any FAQ with "Use as Chatbot Answer" on becomes searchable by the Rally Assistant chatbot automatically — no separate chatbot content to maintain.

**Update chatbot greeting/quick replies/fallback text** — not yet a portal screen; edit the `chatbot_settings`/`chatbot_quick_replies`/`chatbot_contact_actions` tables directly for now.

## The Midnight-Crossing Booking Schedule

RC Rally Hub is open **Monday to Sunday, 6:00 AM to 3:00 AM** — i.e. every "day" of bookable hours actually spans into the next calendar date. This is handled entirely in `src/lib/booking-time.ts` using real `Date` arithmetic (never bare string/hour comparisons), so:

- Selecting an evening date generates slots through **11:00 PM, 12:00 AM, 1:00 AM, 2:00 AM** — the last bookable start time, ending by 3:00 AM.
- Slots at or after midnight are visually labeled **"next day"** and correctly attributed to the next calendar date internally, without ever changing which business day the booking belongs to.
- A booking that starts before midnight and runs past it (e.g. 10:00 PM + 3 hours) correctly computes an end time of 1:00 AM the following calendar date.

This logic is covered by an automated check:

```bash
npm run verify:booking-time
```

which asserts 17 conditions (slot count, exact labels, date rollover, multi-hour crossing bookings, and that no slot is ever generated past the 3:00 AM close). Run this after any change to `operatingHoursStart`/`operatingHoursEnd` or to `booking-time.ts` itself.

## Deploying to Netlify

1. Push this project to a GitHub (or GitLab/Bitbucket) repository.
2. In Netlify: **Add new site → Import an existing project**, select the repo.
3. Build settings are already defined in `netlify.toml` — Netlify will detect `npm run build` and `dist` automatically; you shouldn't need to change anything.
4. Set `NODE_VERSION` (already pinned to `20` in `netlify.toml`) — override in Netlify's UI only if you need a different version.
5. Deploy. Netlify will build and give you a `*.netlify.app` URL.
6. Update `SITE_URL` in `astro.config.mjs` to your real domain (or the final `*.netlify.app` URL) so sitemap/SEO links are correct, then redeploy.
7. Create a real Turso database (via [the Turso dashboard](https://app.turso.tech) or the `turso` CLI) and set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` under **Site settings → Environment variables** to point production at it (omit them and the site falls back to a local libSQL file, which is not what you want in production).
8. Copy your real content into it: `TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/sync-local-to-turso.mjs` — this applies `db/schema.sql` and copies every row (including uploaded images) from `db/local.db`. Safe to re-run any time you want to push local changes up again.
9. Create your first admin login against the production database (or rely on the one copied over by `sync-local-to-turso.mjs`, if you already have one locally): `TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/create-admin-user.mjs <username>`, then log in at `/portal/login`.
10. (Optional) Add a custom domain under **Site settings → Domain management**.

Netlify still rebuilds and redeploys whenever new commits land on the deploy branch (code changes), but **content edits made in `/portal` do not** — they write straight to Turso and appear on the live site immediately.

## Netlify Forms

The Contact form (`ContactForm.astro`) includes a real static `<form data-netlify="true">` in the built HTML, which is what Netlify's form-detection bot requires — this is already wired up and needs no extra configuration. Submissions appear under **Site → Forms** in the Netlify dashboard. To get email notifications for new submissions, go to **Site → Forms → Settings and usage → Add a notification**. (Booking no longer goes through Netlify Forms — see below.)

## Booking System (Separate Project)

Booking is **not** handled on this site anymore. Every "Book Now" / "Book a Court" link across the site takes visitors to a separately built and deployed booking system (a Next.js + Turso project — see the sibling `bookingsystem` project) with real-time availability, double-booking prevention, and an admin approval dashboard. That system always shows a booking as **Pending** until an admin approves it — it never fakes a "Confirmed" state, matching this site's original design principle.

**How the two are wired together:**

- The `business_settings.booking_url` column (editable from the portal's *Business Info* screen) holds the booking system's URL. Every nav link, hero CTA, sticky mobile bar, rate card, and the `/book` page's own button read from this one value — update it once (e.g. after deploying the booking system to Netlify) and every CTA on the site follows.
- `/book` on this site is now a short explainer page (hours, how confirmation works) with a "Continue to Booking" button that opens the booking system in a new tab, so `RC Rally Hub` itself stays open in the visitor's browser.
- If a visitor used the homepage's "Quick Check" widget to pick a date first, that date is carried through as a `?date=` query parameter so they don't have to re-pick it on the booking system.
- The booking system's own `/book` and `/book/confirmation` pages link back to this site via its `NEXT_PUBLIC_MARKETING_SITE_URL` environment variable — set that to this site's real URL once both are deployed.

The old front-end-only demo form (`src/components/BookingForm.astro`, `src/lib/client/booking-form.ts`, and the `/booking-confirmation` page that read its `sessionStorage` result) has been removed now that a real backend exists — there's no reason to keep a fake reservation flow alongside a real one. `netlify/functions/` is still here for anything else this site's frontend might need a secret-holding backend for (see that folder's `README.md`).

**Never put API keys, secrets, or database credentials in any `.astro` or client-side `.ts` file in this repo** — those belong in the booking system's own environment variables (see its `.env.example`), never here.

## Chatbot ("Rally Assistant")

`src/components/ChatbotWidget.astro` renders the widget; `src/lib/client/chatbot.ts` contains the current **rule-based** intent-matching engine (keyword detection → FAQ lookup → canned responses), with conversation history kept in `sessionStorage` for the current tab session only.

It is intentionally architected to make a future upgrade straightforward: swap `buildResponse()`'s rule-based branch for a call to a Netlify Function that proxies to OpenAI (or another LLM), passing the same FAQ/business-info context that's already assembled server-side in `ChatbotWidget.astro`. **Never call OpenAI (or any LLM API) directly from the browser** — always route through a Netlify Function so the API key stays server-side (see `.env.example`).

The widget deliberately avoids overlapping the mobile bottom navigation and the sticky booking bar (`StickyBookingBar.astro`) at all tested breakpoints.

**Video embed safety**: `VideoCarousel.astro` only ever renders an `<iframe>` for a URL whose hostname is exactly `www.facebook.com` and whose path starts with `/plugins/video.php` (see `isApprovedEmbed()`). Raw iframe HTML pasted into the CMS is never executed directly — this prevents a compromised or careless CMS entry from injecting arbitrary markup/scripts.

## SEO & Structured Data

`src/components/SEO.astro` sets a unique title/meta description per page (falling back to `defaultSeo` in Settings), Open Graph/Twitter tags, and canonical URLs. `src/components/StructuredData.astro` emits JSON-LD for `LocalBusiness`/`SportsActivityLocation` (site-wide), `Event` (event detail pages), `FAQPage` (FAQs page), and `BreadcrumbList` (inner pages). `@astrojs/sitemap` generates `sitemap-index.xml` at build time, and `public/robots.txt` disallows `/admin/` and points to the sitemap.

## Accessibility

Built to target **WCAG 2.2 AA**: semantic landmarks and heading order, a visible skip-to-content link, keyboard-operable nav/carousels/accordions/booking flow, visible focus states, sufficient color contrast against the dark brand palette, descriptive alt text on all content images (enforced as a required CMS field on Gallery), `aria-live` regions for the chatbot and slot-availability updates, and `prefers-reduced-motion` handling for all GSAP/CSS animations and the scroll-reveal system.

## Environment Variables

See `.env.example` for the full, documented list. **No environment variables are required for local development** — with `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` unset, the site and portal both fall back to a local libSQL file at `db/local.db`. **In production, set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`** (Netlify → Site settings → Environment variables) to point at your real hosted Turso database — without them, a production deploy would silently run against its own throwaway local file. Other placeholders in `.env.example` are reserved for future server-side integrations (SMS/email notifications, an LLM-powered chatbot) and must only ever be read server-side, never in frontend code.

## Troubleshooting

- **`astro build` fails after upgrading a dependency** — this project pins `astro@^5.18.2`, `@astrojs/sitemap@^3.7.3`, and `@astrojs/tailwind@^6.0.2` together because they're peer-dependency verified against each other; if you bump one, check the others' peer ranges before upgrading.
- **A new content entry doesn't show up** — confirm its `published`/`enabled` column is on, and give the in-memory cache a few seconds to expire (see [Caching](#editing-content-with-the-admin-portal)).
- **Portal login fails** — confirm an `admin_users` row exists for that username (`node scripts/create-admin-user.mjs <username>` creates or updates one), and that cookies are enabled in the browser you're testing with.
- **Local dev fonts/maps look unstyled or broken in a sandboxed environment with no outbound internet** — `Layout.astro` loads Google Fonts and the Contact page embeds Google Maps from their public CDNs; both require normal internet access and will work in any standard browser/deployment.

## Final Quality Checklist

Use this before every major content refresh or release:

- [ ] Every nav link (desktop + mobile) resolves and highlights the active page
- [ ] Address, hours, and location description match across header/footer/contact/chatbot/structured data (all sourced from Settings)
- [ ] Bookings after 11:00 PM through 2:00 AM generate correctly and never revert to the previous day (`npm run verify:booking-time`)
- [ ] Mobile nav opens/closes correctly and doesn't trap focus
- [ ] Booking form validates each step and never shows "Confirmed" without a backend
- [ ] Chatbot greeting, all 8 quick replies, and the fallback message match spec; it answers hours/address/location questions correctly
- [ ] All 10 testimonials present and gliding smoothly in the carousel (keyboard + swipe)
- [ ] Both Facebook videos play and only approved embed URLs render
- [ ] Video carousel maintains a 9:16 layout across breakpoints
- [ ] Animations respect `prefers-reduced-motion`
- [ ] `/portal` is reachable, every sidebar screen loads and saves without errors, and `/admin` returns 404
- [ ] `netlify.toml` redirects/headers deployed correctly (check response headers in production)
- [ ] No secrets/API keys appear anywhere in `src/` or `public/`
- [ ] Dummy contact fields are clearly marked until replaced with real details
