/**
 * booking-time.ts
 * ---------------------------------------------------------------------------
 * Centralized time-slot logic for RC Rally Hub.
 *
 * The venue's official schedule is "Monday to Sunday, 6:00 AM – 3:00 AM"
 * (the following day). That means every single business day actually spans
 * TWO calendar dates: e.g. "Monday" court time includes Monday 6:00 AM all
 * the way through Tuesday 3:00 AM.
 *
 * To avoid the classic bug where a booking silently "loses" its date when the
 * clock crosses midnight, every slot in this module is represented as a real
 * JavaScript `Date` (a single instant in time), never as a bare "HH:mm"
 * string compared in isolation. Durations are added in milliseconds, so a
 * 2-hour booking starting at 1:00 AM correctly resolves to 3:00 AM on the
 * SAME calendar date the slot started on — no manual date-rollover math, and
 * no chance of the UI showing the wrong day.
 *
 * A "business date" below always refers to the date the court opened for
 * that session (6:00 AM), even if part of the session happens after
 * midnight on the following calendar date.
 * ---------------------------------------------------------------------------
 */

export const OPEN_HOUR = 6; // 6:00 AM
export const CLOSE_HOUR = 3; // 3:00 AM the following day
// Number of 1-hour slots between open and close: (24 - 6) + 3 = 21
export const TOTAL_SLOTS = 24 - OPEN_HOUR + CLOSE_HOUR;

// Editable placeholder peak-hour window. Update here (or wire to a CMS
// field) once official peak pricing hours are confirmed. Hours are in
// 24-hour "actual clock" form.
export const PEAK_HOURS = new Set([17, 18, 19, 20, 21, 22]); // 5 PM – 10:59 PM

export interface TimeSlot {
  /** 0-based index of the slot within the business day (0 = 6:00 AM). */
  index: number;
  /** Real Date instant the slot begins. */
  start: Date;
  /** Real Date instant the slot ends (start + 1 hour). */
  end: Date;
  /** True when this slot falls on the calendar day AFTER the business date (i.e. after midnight). */
  isNextCalendarDay: boolean;
  /** Human label, e.g. "11:00 PM – 12:00 AM". */
  label: string;
  /** Short start-time label, e.g. "11:00 PM". */
  startLabel: string;
  /** Whether this slot is inside the peak-hour window. */
  isPeak: boolean;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/** Format a Date's hour/minute as "h:mm AM/PM". */
export function formatTime(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${pad2(m)} ${ampm}`;
}

/** Parse a "YYYY-MM-DD" string into a local Date at midnight. */
export function parseBusinessDate(dateISO: string): Date {
  const [y, m, d] = dateISO.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

export function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Build the real Date instant for a given slot index (0..TOTAL_SLOTS-1)
 * of a given business date. This is the core fix for the midnight
 * rollover: hours from OPEN_HOUR (6) through 23 stay on the business
 * date; hours 0, 1, 2 (and the closing boundary 3) automatically land on
 * the next calendar date because we advance the Date object itself
 * rather than re-using a plain hour number.
 */
export function slotStart(businessDate: Date, slotIndex: number): Date {
  const totalHourOffset = OPEN_HOUR + slotIndex; // e.g. 0 -> 6am, 18 -> 24 (=> 0, next day)
  const dayOffset = Math.floor(totalHourOffset / 24);
  const actualHour = totalHourOffset % 24;
  const dt = new Date(businessDate);
  dt.setDate(dt.getDate() + dayOffset);
  dt.setHours(actualHour, 0, 0, 0);
  return dt;
}

/** Generate all 21 one-hour slots (6:00 AM → 3:00 AM next day) for a business date. */
export function generateTimeSlots(businessDateISO: string): TimeSlot[] {
  const businessDate = parseBusinessDate(businessDateISO);
  const slots: TimeSlot[] = [];
  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const start = slotStart(businessDate, i);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const isNextCalendarDay = formatDateISO(start) !== formatDateISO(businessDate);
    slots.push({
      index: i,
      start,
      end,
      isNextCalendarDay,
      label: `${formatTime(start)} – ${formatTime(end)}`,
      startLabel: formatTime(start),
      isPeak: PEAK_HOURS.has(start.getHours()),
    });
  }
  return slots;
}

/**
 * Given a chosen start slot index and a duration in hours, return the
 * correct end Date — even when it crosses midnight or lands after the
 * 3:00 AM close. Because we operate on Date arithmetic (milliseconds),
 * a booking that starts at 1:00 AM for 2 hours correctly ends at 3:00 AM
 * on the SAME night, with no special-casing required.
 */
export function computeBookingRange(businessDateISO: string, startSlotIndex: number, durationHours: number) {
  const businessDate = parseBusinessDate(businessDateISO);
  const start = slotStart(businessDate, startSlotIndex);
  const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
  return { start, end };
}

/** The last valid start-slot index for a given duration so the booking never runs past 3:00 AM close. */
export function maxStartIndexForDuration(durationHours: number): number {
  return TOTAL_SLOTS - Math.ceil(durationHours) ; // duration in whole hours for slot math
}

export const DURATION_OPTIONS = [
  { label: '1 hour', hours: 1 },
  { label: '1.5 hours', hours: 1.5 },
  { label: '2 hours', hours: 2 },
  { label: '3 hours', hours: 3 },
];

/**
 * Deterministic demo "availability" generator. In production this would
 * be replaced by a real backend / database lookup (see README →
 * "Connecting a Booking Backend"). Uses a seeded hash so the same date
 * always shows the same demo availability instead of shuffling on every
 * render.
 */
function seededHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function isSlotUnavailable(businessDateISO: string, slotIndex: number): boolean {
  const seed = seededHash(`${businessDateISO}-${slotIndex}`);
  // ~28% of slots show as unavailable in the demo, in a stable pattern.
  return seed % 100 < 28;
}

export function isDateFullyBooked(businessDateISO: string): boolean {
  const slots = generateTimeSlots(businessDateISO);
  return slots.every((s) => isSlotUnavailable(businessDateISO, s.index));
}

/** Check whether `count` consecutive slots starting at `startIndex` are all available. */
export function areConsecutiveSlotsAvailable(businessDateISO: string, startIndex: number, count: number): boolean {
  if (startIndex < 0 || startIndex + count > TOTAL_SLOTS) return false;
  for (let i = 0; i < count; i++) {
    if (isSlotUnavailable(businessDateISO, startIndex + i)) return false;
  }
  return true;
}

export function generateReferenceNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = pad2(now.getMonth() + 1);
  const d = pad2(now.getDate());
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `RCH-${y}${m}${d}-${rand}`;
}

export type BookingStatus = 'Pending Confirmation' | 'Confirmed' | 'Completed' | 'Cancelled' | 'Rescheduled';
