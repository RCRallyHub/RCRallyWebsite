import { getDb } from '../db';
import { cached } from './cache';

export interface ChatbotData {
  enabled: boolean;
  chatbotName: string;
  greeting: string;
  fallbackMessage: string;
  notificationDelaySeconds: number;
  quickReplies: { label: string; intent: string }[];
  bookingLink: string;
  contactActions: { label: string; type: string; value: string }[];
}

async function fetchChatbotSettings(): Promise<ChatbotData> {
  const db = getDb();
  const row = (await db.execute('SELECT * FROM chatbot_settings WHERE id = 1')).rows[0];
  if (!row) throw new Error('chatbot_settings row missing — run scripts/migrate-to-turso.mjs');

  const quickReplyRows = (
    await db.execute('SELECT label, intent FROM chatbot_quick_replies ORDER BY sort_order')
  ).rows;
  const contactActionRows = (
    await db.execute('SELECT label, type, value FROM chatbot_contact_actions ORDER BY sort_order')
  ).rows;

  return {
    enabled: !!row.enabled,
    chatbotName: String(row.chatbot_name),
    greeting: String(row.greeting),
    fallbackMessage: String(row.fallback_message),
    notificationDelaySeconds: Number(row.notification_delay_seconds),
    quickReplies: quickReplyRows.map((q) => ({ label: String(q.label), intent: String(q.intent) })),
    bookingLink: String(row.booking_link),
    contactActions: contactActionRows.map((a) => ({
      label: String(a.label),
      type: String(a.type),
      value: String(a.value),
    })),
  };
}

export function getChatbotSettings(): Promise<ChatbotData> {
  return cached('chatbot', fetchChatbotSettings);
}
