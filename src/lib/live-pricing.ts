/**
 * live-pricing.ts
 * ---------------------------------------------------------------------------
 * This site is a fully static build (`output: 'static'` in astro.config.mjs)
 * — every page is prerendered once at build/deploy time, so anything read
 * only in Astro frontmatter would be "live" only as of the last deploy, not
 * per visitor. To show pricing that reflects what the admin has configured
 * on the booking system's Settings page *right now*, this fetch has to run
 * in the browser, after the static page has already loaded — see how
 * rates.astro and PricingCalculator.astro use this.
 *
 * Every consumer of this module must keep working with zero JS and with the
 * booking system unreachable: the static, CMS-authored placeholder content
 * already in each page is the fallback, and this fetch either upgrades that
 * content in place or silently leaves it alone. Never throw, never block
 * rendering, never show a visible error for this specific fetch failing.
 * ---------------------------------------------------------------------------
 */

export interface LivePricing {
  currency: string;
  offPeakStartTime: string; // "06:00"
  offPeakEndTime: string; // "18:00"
  offPeakPricePerHour: number;
  peakPricePerHour: number;
  paymentMethod: 'gcash' | 'bank_transfer';
  gcashName: string | null;
  gcashNumber: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
}

const FETCH_TIMEOUT_MS = 5000;

/**
 * Derives the booking system's origin (e.g. "https://book.rcrallyhub.com")
 * from its full booking-page URL (e.g. ".../book"), which is the one field
 * already configured in the CMS (`settings.bookingUrl`, used for every
 * "Book Now" link on this site) — no separate URL to keep in sync.
 */
export function bookingSystemOriginFrom(bookingUrl: string): string | null {
  try {
    return new URL(bookingUrl).origin;
  } catch {
    return null;
  }
}

/**
 * Fetches live pricing/payment info from the booking system's public
 * `/api/config` endpoint. Returns null on ANY failure (unreachable, CORS
 * blocked, still pointed at the example.com placeholder, slow, malformed
 * response, etc.) — callers must treat null as "keep the static fallback",
 * not as an error to surface to the visitor.
 */
export async function fetchLivePricing(bookingUrl: string | null | undefined): Promise<LivePricing | null> {
  if (!bookingUrl) return null;
  const origin = bookingSystemOriginFrom(bookingUrl);
  if (!origin || origin.includes('your-booking-system.example.com')) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${origin}/api/config`, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const b = data?.business;
    if (
      !b ||
      typeof b.offPeakPricePerHour !== 'number' ||
      typeof b.peakPricePerHour !== 'number' ||
      typeof b.offPeakStartTime !== 'string' ||
      typeof b.offPeakEndTime !== 'string'
    ) {
      return null;
    }
    return {
      currency: b.currency || 'PHP',
      offPeakStartTime: b.offPeakStartTime,
      offPeakEndTime: b.offPeakEndTime,
      offPeakPricePerHour: b.offPeakPricePerHour,
      peakPricePerHour: b.peakPricePerHour,
      paymentMethod: b.paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'gcash',
      gcashName: b.gcashName ?? null,
      gcashNumber: b.gcashNumber ?? null,
      bankName: b.bankName ?? null,
      bankAccountName: b.bankAccountName ?? null,
      bankAccountNumber: b.bankAccountNumber ?? null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Formats a peso amount for display, e.g. 250 -> "₱250". Whole pesos only — matches this site's existing rate-card copy style ("Starting at ₱250 per hour"). */
export function formatPeso(amount: number): string {
  return `₱${Math.round(amount).toLocaleString('en-PH')}`;
}

/** "06:00" -> 6, "18:30" -> 18 (minutes truncated — hour-granularity is all the demo slot grid needs). */
export function hourFromTimeString(t: string): number {
  const [h] = t.split(':').map(Number);
  return h ?? 0;
}

/**
 * True when `hour` (0-23) falls inside live peak hours, given the off-peak
 * window [offPeakStartHour, offPeakEndHour) — mirrors the booking system's
 * own lib/pricing.ts wraparound rule (off-peak end <= start means the
 * off-peak window crosses midnight into the next day).
 */
export function isPeakHour(hour: number, pricing: LivePricing): boolean {
  const start = hourFromTimeString(pricing.offPeakStartTime);
  const end = hourFromTimeString(pricing.offPeakEndTime);
  const inOffPeak = end > start ? hour >= start && hour < end : hour >= start || hour < end;
  return !inOffPeak;
}
