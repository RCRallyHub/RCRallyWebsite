// Verification script for the midnight-crossing booking logic.
// Run with: node scripts/verify-booking-time.mjs
// (Node 20+/22+ supports importing .ts files with type stripping.)

import {
  generateTimeSlots,
  computeBookingRange,
  formatTime,
  formatDateISO,
  TOTAL_SLOTS,
  OPEN_HOUR,
} from '../src/lib/booking-time.ts';

let failures = 0;
function assert(condition, message) {
  if (!condition) {
    failures++;
    console.error(`✗ FAIL: ${message}`);
  } else {
    console.log(`✓ ${message}`);
  }
}

const BUSINESS_DATE = '2026-08-10'; // a Monday

// 1) There should be exactly 21 slots (6am -> 3am next day)
const slots = generateTimeSlots(BUSINESS_DATE);
assert(slots.length === TOTAL_SLOTS, `generates ${TOTAL_SLOTS} hourly slots (6:00 AM to 3:00 AM)`);
assert(slots[0].startLabel === '6:00 AM', `first slot starts at 6:00 AM (got ${slots[0].startLabel})`);

// 2) The last few slots should be on the NEXT calendar date
const last = slots[slots.length - 1];
assert(last.startLabel === '2:00 AM', `last slot starts at 2:00 AM (got ${last.startLabel})`);
assert(formatDateISO(last.start) === '2026-08-11', `2:00 AM slot lands on the next calendar date (got ${formatDateISO(last.start)})`);
assert(last.isNextCalendarDay === true, '2:00 AM slot is flagged isNextCalendarDay');
assert(formatTime(last.end) === '3:00 AM', `2:00 AM slot ends at 3:00 AM (got ${formatTime(last.end)})`);

// 3) A slot starting at 11:00 PM should stay on the ORIGINAL business date
const elevenPmSlot = slots.find((s) => s.startLabel === '11:00 PM');
assert(!!elevenPmSlot, '11:00 PM slot exists');
assert(formatDateISO(elevenPmSlot.start) === BUSINESS_DATE, '11:00 PM slot start stays on the business date');
assert(elevenPmSlot.isNextCalendarDay === false, '11:00 PM slot is NOT flagged as next-day');
assert(formatDateISO(elevenPmSlot.end) === '2026-08-11', '11:00 PM slot END correctly rolls to the next calendar date (12:00 AM)');

// 4) A 2-hour booking starting at 1:00 AM must end at 3:00 AM the SAME night
//    (index for 1:00 AM = slot 19, since 6am=0 ... 1am is hour 19 past 6am)
const oneAmSlot = slots.find((s) => s.startLabel === '1:00 AM');
assert(!!oneAmSlot, '1:00 AM slot exists');
const { start, end } = computeBookingRange(BUSINESS_DATE, oneAmSlot.index, 2);
assert(formatTime(start) === '1:00 AM', `booking starts at 1:00 AM (got ${formatTime(start)})`);
assert(formatTime(end) === '3:00 AM', `2-hour booking from 1:00 AM correctly ends at 3:00 AM (got ${formatTime(end)})`);
assert(formatDateISO(end) === '2026-08-11', 'end time lands on the correct (next) calendar date');

// 5) A booking that starts well before midnight and crosses into the next
//    day should also resolve correctly (e.g. 10:00 PM + 3 hours = 1:00 AM)
const tenPmSlot = slots.find((s) => s.startLabel === '10:00 PM');
const crossMidnight = computeBookingRange(BUSINESS_DATE, tenPmSlot.index, 3);
assert(formatTime(crossMidnight.end) === '1:00 AM', `10:00 PM + 3h ends at 1:00 AM (got ${formatTime(crossMidnight.end)})`);
assert(formatDateISO(crossMidnight.end) === '2026-08-11', '10:00 PM + 3h end date rolls to the next calendar date');

// 6) No slot should ever be generated past the 3:00 AM close
const maxEnd = slots[slots.length - 1].end;
assert(formatTime(maxEnd) === '3:00 AM', 'no generated slot ends later than 3:00 AM close');

console.log('\n' + (failures === 0 ? `All checks passed! (${slots.length} slots verified for ${BUSINESS_DATE})` : `${failures} check(s) FAILED`));
process.exit(failures === 0 ? 0 : 1);
