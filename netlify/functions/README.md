# Netlify Functions — Future Integration Points

This directory is intentionally close to empty. Booking is **no longer**
handled on this site — every "Book Now" / "Book a Court" link takes
visitors to a separately deployed booking system (see the sibling
`bookingsystem` repo/project), configured via `bookingUrl` in
`src/content/settings/settings.yml` (also editable from the CMS under
Settings → "Booking System URL"). That system has its own Next.js API
routes, Turso database, and admin dashboard — it does not live in this
repo or deploy through this `netlify.toml`.

This directory is still here for anything else this site's frontend might
eventually need a secret-holding backend for. **Never** put API keys or
database credentials in frontend code (anything in `src/`) since that ships
to every visitor's browser.

## Suggested functions to add here

- **`chatbot-ai.ts`** — a server-side proxy to the OpenAI API (or another
  LLM) for a smarter Rally Assistant. Keep `OPENAI_API_KEY` in Netlify
  environment variables and call it only from here; the current
  `src/lib/client/chatbot.ts` rule-based engine is designed to be swapped
  for a fetch to this endpoint without changing its message-rendering code.
- **`send-contact-email.ts`** — if you want the contact page to notify an
  inbox directly instead of relying on Netlify Forms' own notification
  settings.

If you ever want booking logic to move back into this site instead of the
separate system, `create-booking.ts` / `check-availability.ts` /
`send-confirmation-email.ts` would be the natural functions to add — but
that would mean re-implementing what the `bookingsystem` project's API
routes already do (real availability checking, double-booking prevention,
admin approval workflow), so keeping the two separate is the simpler path.

## Example shape

```ts
// netlify/functions/create-booking.ts
import type { Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  const payload = await req.json();
  // 1. Validate payload
  // 2. Check availability against your database
  // 3. Write the booking record
  // 4. Trigger send-confirmation-email / send-sms-notification
  // 5. Return the real status
  return new Response(JSON.stringify({ status: "Pending Confirmation" }), {
    headers: { "Content-Type": "application/json" },
  });
};
```

Add any required secrets in **Netlify → Site configuration → Environment
variables** (see `.env.example` in the project root for the expected
names) — never commit real secrets to the repository.
