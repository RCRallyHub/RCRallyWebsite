# RC Rally Hub by Garahe — Website

The official multi-page website for **RC Rally Hub by Garahe**, a covered pickleball venue inside Garahe by Chef Rods Restaurant in Pala-o, Iligan City, Philippines. Built with [Astro](https://astro.build), TypeScript, and Tailwind CSS, content-managed with [Sveltia CMS](https://github.com/sveltia/sveltia-cms), and deployed on [Netlify](https://www.netlify.com).

This site itself is fully static — there is no database here. Real-time booking (availability, double-booking prevention, admin approval) is handled by a separate booking system that every "Book Now" link on this site points to; see [Booking System (Separate Project)](#booking-system-separate-project).

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Local Development](#local-development)
4. [Content Model & The Single Source of Truth](#content-model--the-single-source-of-truth)
5. [Editing Content With Sveltia CMS](#editing-content-with-sveltia-cms)
6. [Sveltia CMS Authentication Setup](#sveltia-cms-authentication-setup)
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
| Framework | [Astro 5](https://astro.build) (`output: 'static'`, directory-style URLs) |
| Language | TypeScript |
| Styling | Tailwind CSS v3 (custom brand theme in `tailwind.config.mjs`) |
| Content | Astro Content Collections (Markdown + YAML), edited via Sveltia CMS |
| CMS | [Sveltia CMS](https://github.com/sveltia/sveltia-cms) (Decap-CMS-compatible, loaded from `/admin`) |
| Carousels | [Swiper](https://swiperjs.com) (testimonials, featured videos) |
| Animation | [GSAP](https://gsap.com) (hero entrance) + CSS/IntersectionObserver scroll-reveal |
| Forms | Netlify Forms (progressively enhanced with `fetch()`) |
| Hosting | Netlify (static hosting + Netlify Forms + future Netlify Functions) |
| Sitemap | `@astrojs/sitemap` |

## Project Structure

```
rc-rally-hub/
├── astro.config.mjs        # Astro config (site URL, integrations)
├── tailwind.config.mjs      # Brand colors, fonts, animations
├── netlify.toml              # Build settings, redirects, headers, CSP
├── .env.example               # Documented placeholder env vars
├── public/
│   ├── admin/                 # Sveltia CMS (index.html + config.yml)
│   ├── images/                # Logo, photos, favicons
│   ├── robots.txt, site.webmanifest
├── scripts/
│   └── verify-booking-time.mjs   # Automated check for the midnight-crossing logic
├── src/
│   ├── content/                # ALL editable content (see below)
│   │   ├── settings/settings.yml     # ⭐ single source of truth for business info
│   │   ├── pages/                    # per-page hero/meta content
│   │   ├── homeContent/, aboutContent/
│   │   ├── rates/, events/, gallery/, videos/, testimonials/, faqs/, addons/
│   │   ├── chatbot/chatbot.yml
│   │   └── policies/                 # Privacy, Terms, Cancellation & Rescheduling
│   ├── components/              # Reusable Astro components (Header, Footer, cards, forms…)
│   │   └── home/                    # Home-page-only section components
│   ├── layouts/Layout.astro      # Base HTML shell, fonts, SEO/meta wiring
│   ├── lib/
│   │   ├── booking-time.ts          # Core midnight-crossing time-slot logic
│   │   └── client/                  # Client-side scripts (chatbot.ts)
│   ├── pages/                    # File-based routes (the 15 required pages)
│   └── styles/global.css
```

## Local Development

Requires **Node.js 18.17+** (Node 20/22 recommended).

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:4321`. The CMS admin is reachable at `http://localhost:4321/admin` but will only fully authenticate against your real GitHub repo once deployed (see [Sveltia CMS Authentication Setup](#sveltia-cms-authentication-setup)) — for pure content-writing on your machine, editing the YAML/Markdown files in `src/content/` directly is equally valid and instant.

Other scripts:

```bash
npm run build             # astro check + full static build to dist/
npm run preview           # serve the built dist/ locally, like production
npm run verify:booking-time   # run the automated midnight-crossing assertions
```

## Content Model & The Single Source of Truth

Every editable piece of content lives under `src/content/` as an Astro **content collection** (schemas defined in `src/content/config.ts`). Nothing is hardcoded into components — all business info, copy, rates, events, gallery items, videos, testimonials, FAQs, and chatbot text are pulled from these files at build time.

**`src/content/settings/settings.yml` is the single source of truth** for:

- Business name, tagline, logo, favicon
- Address & location description
- Operating hours (both the human-readable string and the `HH:mm` values used by the booking system)
- Contact details — mobile, email, Facebook, Messenger — **each with an `...IsDummy: true` flag**. These are currently placeholder values (`0917 555 7288`, `play@rcrallyhub.com`, `facebook.com/RCRallyHub`). Replace them with real details and flip the matching `IsDummy` flag to `false` and the "(DUMMY)" badge next to them on the Contact page and footer disappears automatically.
- Social links, the announcement bar, footer text, and default SEO title/description/share image

Change something here once and it updates everywhere it's used (header, footer, contact page, chatbot answers, structured data, etc.) — you never need to hunt for a second place to edit hours or an address.

## Editing Content With Sveltia CMS

Once deployed, open **`https://your-site.netlify.app/admin`** and log in (see auth setup below). The left sidebar has one section per content type, matching the collections in `public/admin/config.yml`:

- 🏓 **Global Settings** — the `settings.yml` file described above
- 📄 **Pages** — per-page hero heading/subheading/meta for each of the 15 routes
- 🏠 **Home Page Sections** — quick highlights, why-choose-us cards, animated stats, booking-steps copy
- 🙋 **About Page Sections** — values, team, partners
- 💰 **Rates & Packages** — one entry per package/rate card, with an `isPlaceholderPrice` flag
- 🏆 **Tournaments & Events** — listing + full detail page per event, with status/category
- 🖼️ **Gallery** — one entry per photo, with category, alt text, and display order
- 🎬 **Videos** — Facebook video entries; only the pre-generated `facebook.com/plugins/video.php` **Approved Embed URL** is ever rendered (see [Chatbot](#chatbot-rally-assistant) note on safety below)
- 💬 **Testimonials** — customer quotes shown in the homepage carousel
- ❓ **FAQs** — question/answer/category, plus a "use as chatbot answer" toggle
- 🎾 **Booking Add-ons** — optional extras shown on the rates page's cost estimator (informational only — the actual booking flow happens on the separate booking system and doesn't include add-ons yet)
- 🤖 **Rally Assistant Chatbot** — greeting, fallback message, quick replies, contact actions
- 📜 **Policies** — Privacy, Terms, and Cancellation & Rescheduling body text

All fields have labels and hints in the CMS UI — no code editing is required for day-to-day content updates.

## Sveltia CMS Authentication Setup

The CMS backend is configured as `github` in `public/admin/config.yml`. **Do not use Netlify Identity or Git Gateway** — both are deprecated/sunset by Netlify. Instead, use Netlify's built-in **OAuth provider for external Git-based CMS tools**, which is the currently supported method:

1. Push this repository to GitHub.
2. In the Netlify dashboard: **Site settings → General → set the correct repo**, then go to **Site settings → Access control → OAuth**.
3. Under "Authorized OAuth applications for Git-based CMS", add a provider for **GitHub** and follow Netlify's prompts to link a GitHub OAuth App (Netlify will show you the exact callback URL to paste into GitHub's OAuth App settings at `github.com/settings/developers`).
4. In `public/admin/config.yml`, set `backend.repo` to `your-github-username/your-repo-name` and `backend.branch` to the branch you deploy from (default `main`).
5. Visit `https://your-site.netlify.app/admin`, click "Login with GitHub", and authorize. You must be a collaborator on the GitHub repo to be granted write access.

If Netlify ever changes or retires this OAuth flow, check [Sveltia CMS's own backend docs](https://github.com/sveltia/sveltia-cms#configuration) for the current supported alternatives (self-hosted OAuth client, GitLab, etc.) before assuming any specific provider is still available.

## Common Editing Tasks

**Update hours or address** → CMS: *Global Settings*. Directly in code: `src/content/settings/settings.yml`. If hours change, also update `operatingHoursStart` / `operatingHoursEnd` (24-hour `HH:mm`) — these drive the booking time-slot generator.

**Replace the dummy phone/email/Facebook** → CMS: *Global Settings → Contact Details*, update the value and set the matching `Is ... a Dummy/Placeholder?` toggle to off.

**Add/edit a rate package** → CMS: *Rates & Packages → New Rate*. Prices are plain display text (e.g. `"Starting at ₱250 per hour"`) — update `isPlaceholderPrice` to `false` once real pricing is confirmed.

**Add a tournament/event** → CMS: *Tournaments & Events → New Event*. Set `status` (Upcoming / Registration Open / etc.) and `featured` to control homepage visibility.

**Add gallery photos** → CMS: *Gallery → New Gallery Item*. Upload the image (saved to `public/images/uploads`), pick a category, and always fill in the **Alt Text** field for accessibility.

**Add a video** → CMS: *Videos → New Video*. You need the video's **embed URL**, generated at Facebook's [Video Plugin tool](https://developers.facebook.com/docs/plugins/embedded-video-player) — paste the resulting `https://www.facebook.com/plugins/video.php?...` URL into "Approved Embed URL". Any other domain is silently ignored by `VideoCarousel.astro` for security (see below).

**Update testimonials** → CMS: *Testimonials*. All 10 launch testimonials are pre-loaded; add, remove, or reorder freely with `displayOrder`.

**Update FAQs / chatbot answers** → CMS: *FAQs*. Any FAQ with "Use as Chatbot Answer" on becomes searchable by the Rally Assistant chatbot automatically — no separate chatbot content to maintain.

**Update chatbot greeting/quick replies/fallback text** → CMS: *Rally Assistant Chatbot*.

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
6. Update `SITE_URL` in `astro.config.mjs` and `site_url`/`display_url` in `public/admin/config.yml` to your real domain (or the final `*.netlify.app` URL) so sitemap/SEO/CMS links are correct, then redeploy.
7. Set up Sveltia CMS auth (see above) so editors can log in at `/admin`.
8. (Optional) Add a custom domain under **Site settings → Domain management**, and add environment variables under **Site settings → Environment variables** if/when you connect real integrations (see below).

Netlify automatically rebuilds and redeploys whenever new commits land on the deploy branch — including commits made by Sveltia CMS itself when an editor publishes content.

## Netlify Forms

The Contact form (`ContactForm.astro`) includes a real static `<form data-netlify="true">` in the built HTML, which is what Netlify's form-detection bot requires — this is already wired up and needs no extra configuration. Submissions appear under **Site → Forms** in the Netlify dashboard. To get email notifications for new submissions, go to **Site → Forms → Settings and usage → Add a notification**. (Booking no longer goes through Netlify Forms — see below.)

## Booking System (Separate Project)

Booking is **not** handled on this site anymore. Every "Book Now" / "Book a Court" link across the site takes visitors to a separately built and deployed booking system (a Next.js + Turso project — see the sibling `bookingsystem` project) with real-time availability, double-booking prevention, and an admin approval dashboard. That system always shows a booking as **Pending** until an admin approves it — it never fakes a "Confirmed" state, matching this site's original design principle.

**How the two are wired together:**

- `src/content/settings/settings.yml`'s `bookingUrl` field (also editable from the CMS under *Settings → Booking System URL*) holds the booking system's URL. Every nav link, hero CTA, sticky mobile bar, rate card, and the `/book` page's own button read from this one value — update it once (e.g. after deploying the booking system to Netlify) and every CTA on the site follows.
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

See `.env.example` for the full, documented list. **No environment variables are required to build or run the site today** — the current CMS auth flow (GitHub OAuth via Netlify) and Netlify Forms both work without any secrets in this repo. The placeholders in `.env.example` are reserved for future server-side integrations (a real booking backend, SMS/email notifications, an LLM-powered chatbot) and must only ever be read inside Netlify Functions, never in frontend code.

## Troubleshooting

- **`astro build` fails after upgrading a dependency** — this project pins `astro@^5.18.2`, `@astrojs/sitemap@^3.7.3`, and `@astrojs/tailwind@^6.0.2` together because they're peer-dependency verified against each other; if you bump one, check the others' peer ranges before upgrading.
- **A new content entry doesn't show up** — confirm its `published` field (or equivalent) is `true`, and that you're looking at the collection whose `folder`/`file` matches where the CMS actually saved it (see `public/admin/config.yml`).
- **CMS shows a login error** — re-check the OAuth App setup in [Sveltia CMS Authentication Setup](#sveltia-cms-authentication-setup); a mismatched callback URL is the most common cause.
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
- [ ] All Sveltia CMS collections are reachable and editable at `/admin`
- [ ] `netlify.toml` redirects/headers deployed correctly (check response headers in production)
- [ ] No secrets/API keys appear anywhere in `src/` or `public/`
- [ ] Dummy contact fields are clearly marked until replaced with real details
