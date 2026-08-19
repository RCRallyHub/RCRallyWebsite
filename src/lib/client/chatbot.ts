/**
 * Rally Assistant — rule-based chatbot engine.
 *
 * Architecture note (documented per project requirements): this is a v1
 * rule-based implementation driven entirely by CMS content (business
 * settings + FAQs marked "useAsChatbotAnswer"). It is intentionally
 * decoupled from rendering so it can be swapped later for a Netlify
 * Function that calls the OpenAI API — see README → "Chatbot: Future
 * Integration Path". No API keys are used or required client-side.
 */

interface ChatbotConfig {
  enabled: boolean;
  chatbotName: string;
  greeting: string;
  fallbackMessage: string;
  notificationDelaySeconds: number;
  bookingLink: string;
  quickReplies: { label: string; intent: string }[];
  contactActions: { label: string; type: string; value: string }[];
}

interface FaqEntry {
  question: string;
  answer: string;
  category: string;
}

interface BusinessSettings {
  businessName: string;
  address: string;
  locationDescription: string;
  operatingHours: string;
  contact: { mobile: string; email: string; facebook: string };
}

interface ChatMessage {
  role: 'bot' | 'user';
  text: string;
  actions?: { label: string; href: string }[];
  ts: number;
}

const STORAGE_KEY = 'rc-rally-hub-chat-history-v1';

function loadHistory(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(messages: ChatMessage[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    /* storage unavailable — degrade gracefully, no history persistence */
  }
}

// --- Intent detection -------------------------------------------------
const INTENT_KEYWORDS: Record<string, string[]> = {
  booking: ['book', 'reserve', 'reservation', 'schedule a', 'slot'],
  rates: ['rate', 'price', 'cost', 'how much', 'fee', 'pricing'],
  schedules: ['available', 'availability', 'open slot', 'time slot', 'schedule'],
  hours: ['hour', 'open', 'close', 'time are you', 'operating'],
  location: ['where', 'location', 'address', 'direction', 'map'],
  amenities: ['amenities', 'facility', 'facilities', 'parking', 'restroom', 'seating'],
  equipment: ['paddle', 'ball rental', 'equipment', 'rent a', 'gear'],
  events: ['tournament', 'event', 'clinic', 'open play', 'competition'],
  cancellation: ['cancel', 'refund'],
  rescheduling: ['resched', 'change my booking', 'move my'],
  contact: ['contact', 'phone', 'email', 'call', 'message', 'facebook'],
  midnight: ['midnight', 'after 12', 'past 12', '1am', '2am', '3am', 'overnight'],
};

function detectIntent(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return intent;
  }
  return null;
}

function findFaqMatch(text: string, faqs: FaqEntry[]): FaqEntry | null {
  const lower = text.toLowerCase();
  const words = lower.split(/\W+/).filter((w) => w.length > 3);
  let best: { faq: FaqEntry; score: number } | null = null;
  for (const faq of faqs) {
    const qLower = faq.question.toLowerCase();
    let score = 0;
    if (qLower === lower) score += 10;
    for (const w of words) {
      if (qLower.includes(w)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { faq, score };
    }
  }
  return best && best.score >= 2 ? best.faq : null;
}

export function initChatbot(config: ChatbotConfig, faqs: FaqEntry[], settings: BusinessSettings) {
  if (!config.enabled) return;

  const root = document.getElementById('rally-assistant');
  if (!root) return;

  const launcher = document.getElementById('chatbot-launcher') as HTMLButtonElement;
  const panel = document.getElementById('chatbot-panel') as HTMLElement;
  const closeBtn = document.getElementById('chatbot-close') as HTMLButtonElement;
  const minimizeBtn = document.getElementById('chatbot-minimize') as HTMLButtonElement;
  const messagesEl = document.getElementById('chatbot-messages') as HTMLElement;
  const form = document.getElementById('chatbot-form') as HTMLFormElement;
  const input = document.getElementById('chatbot-input') as HTMLInputElement;
  const quickRepliesEl = document.getElementById('chatbot-quick-replies') as HTMLElement;
  const badge = document.getElementById('chatbot-badge') as HTMLElement;

  let messages: ChatMessage[] = loadHistory();
  let isOpen = false;

  function renderActions(actions?: { label: string; href: string }[]) {
    if (!actions || actions.length === 0) return '';
    return `<div class="flex flex-wrap gap-2 mt-2">${actions
      .map(
        (a) =>
          `<a href="${a.href}" class="text-xs font-heading font-bold uppercase tracking-wide px-3 py-1.5 rounded-full bg-rc-lime text-rc-black hover:bg-rc-lime-light transition-colors">${a.label}</a>`
      )
      .join('')}</div>`;
  }

  function renderMessages() {
    messagesEl.innerHTML = messages
      .map((m) => {
        if (m.role === 'user') {
          return `<div class="flex justify-end"><div class="max-w-[80%] rounded-2xl rounded-br-sm bg-rc-purple text-white px-4 py-2.5 text-sm leading-relaxed">${escapeHtml(m.text)}</div></div>`;
        }
        return `<div class="flex justify-start gap-2"><div class="w-7 h-7 rounded-full bg-rc-lime/20 border border-rc-lime/40 flex items-center justify-center shrink-0 mt-0.5"><span class="text-[10px] font-bold text-rc-lime">RA</span></div><div class="max-w-[80%] rounded-2xl rounded-bl-sm bg-white/8 text-rc-white px-4 py-2.5 text-sm leading-relaxed">${escapeHtml(m.text)}${renderActions(m.actions)}</div></div>`;
      })
      .join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function escapeHtml(str: string) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function pushMessage(msg: ChatMessage) {
    messages.push(msg);
    saveHistory(messages);
    renderMessages();
  }

  function showTyping(): Promise<void> {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.id = 'chatbot-typing';
      el.className = 'flex justify-start gap-2';
      el.innerHTML = `<div class="w-7 h-7 rounded-full bg-rc-lime/20 border border-rc-lime/40 flex items-center justify-center shrink-0"><span class="text-[10px] font-bold text-rc-lime">RA</span></div><div class="rounded-2xl rounded-bl-sm bg-white/8 px-4 py-3 flex gap-1 items-center"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`;
      messagesEl.appendChild(el);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      const delay = 500 + Math.random() * 500;
      setTimeout(() => {
        el.remove();
        resolve();
      }, delay);
    });
  }

  async function respondTo(text: string) {
    await showTyping();
    const intent = detectIntent(text);
    const response = buildResponse(intent, text);
    pushMessage({ role: 'bot', text: response.text, actions: response.actions, ts: Date.now() });
  }

  function buildResponse(intent: string | null, rawText: string): { text: string; actions?: { label: string; href: string }[] } {
    switch (intent) {
      case 'booking':
        return {
          text: `You can reserve a court in a few quick steps — pick your date and time, choose players and add-ons, then submit your details. We're open ${settings.operatingHours}.`,
          actions: [{ label: 'Book a Court', href: config.bookingLink }],
        };
      case 'rates':
        return {
          text: `Rates vary by peak and off-peak hours, plus packages for groups, coaching, and tournaments. Check our Rates & Packages page for the current pricing.`,
          actions: [{ label: 'View Rates', href: '/rates' }],
        };
      case 'schedules':
        return {
          text: `Our booking page shows live demo availability for any date you pick, including overnight slots. Give it a try!`,
          actions: [{ label: 'Check Availability', href: config.bookingLink }],
        };
      case 'hours':
        return { text: `${settings.businessName} is open ${settings.operatingHours}.` };
      case 'location':
        return {
          text: `We're at ${settings.address} — ${settings.locationDescription}.`,
          actions: [{ label: 'Get Directions', href: '/contact' }],
        };
      case 'midnight':
        return {
          text: `Yes! Since we're open until 3:00 AM, you can book overnight slots like 11:00 PM–12:00 AM, 1:00–2:00 AM, or 2:00–3:00 AM. Our booking system keeps the date correct even when it crosses midnight.`,
          actions: [{ label: 'Book a Court', href: config.bookingLink }],
        };
      case 'amenities':
        return { text: `Our venue includes a covered, lined pickleball court, court lighting, and a viewing area for spectators. See our About page for more on the venue.`, actions: [{ label: 'About the Venue', href: '/about' }] };
      case 'equipment':
        return {
          text: `Yes, paddle and ball rentals are available — just add them in Step 2 of the booking form.`,
          actions: [{ label: 'Book & Add Equipment', href: config.bookingLink }],
        };
      case 'events':
        return {
          text: `We regularly host open play, clinics, and tournaments across divisions. Check our Tournaments & Events page for what's coming up.`,
          actions: [{ label: 'See Events', href: '/events' }],
        };
      case 'cancellation':
        return {
          text: `Cancellations made at least 24 hours before your session are eligible for a full deposit refund. See our full Cancellation & Rescheduling Policy for details.`,
          actions: [{ label: 'Cancellation Policy', href: '/cancellation-policy' }],
        };
      case 'rescheduling':
        return {
          text: `You can reschedule at least 12 hours before your session, subject to availability. See our Cancellation & Rescheduling Policy for full details.`,
          actions: [{ label: 'Rescheduling Policy', href: '/cancellation-policy' }],
        };
      case 'contact':
        return {
          text: `You can reach RC Rally Hub by phone, email, or Facebook Messenger — or send us a message through our contact form.`,
          actions: [{ label: 'Contact Us', href: '/contact' }],
        };
      default: {
        const faqMatch = findFaqMatch(rawText, (window as any).__RC_FAQS__ || []);
        if (faqMatch) {
          return { text: faqMatch.answer };
        }
        return { text: config.fallbackMessage };
      }
    }
  }

  function open() {
    isOpen = true;
    panel.classList.remove('pointer-events-none', 'opacity-0', 'translate-y-4', 'scale-95');
    launcher.setAttribute('aria-expanded', 'true');
    badge.classList.add('hidden');
    input.focus();
    if (messages.length === 0) {
      pushMessage({ role: 'bot', text: config.greeting, ts: Date.now() });
    }
  }

  function close() {
    isOpen = false;
    panel.classList.add('pointer-events-none', 'opacity-0', 'translate-y-4', 'scale-95');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  }

  launcher?.addEventListener('click', () => (isOpen ? close() : open()));
  closeBtn?.addEventListener('click', close);
  minimizeBtn?.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) close();
  });

  quickRepliesEl?.querySelectorAll('button[data-intent]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const label = btn.getAttribute('data-label') || '';
      const intentValue = btn.getAttribute('data-intent') || '';
      pushMessage({ role: 'user', text: label, ts: Date.now() });
      await showTyping();
      const response = buildResponse(intentValue, label);
      pushMessage({ role: 'bot', text: response.text, actions: response.actions, ts: Date.now() });
    });
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    pushMessage({ role: 'user', text, ts: Date.now() });
    input.value = '';
    await respondTo(text);
  });

  // restore prior session
  if (messages.length > 0) {
    renderMessages();
  }

  // Notification bubble after configured delay if not yet opened
  window.setTimeout(() => {
    if (!isOpen) badge.classList.remove('hidden');
  }, (config.notificationDelaySeconds || 4) * 1000);

  (window as any).__RC_FAQS__ = faqs;
}
