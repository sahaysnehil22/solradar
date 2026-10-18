/**
 * SolRadar Web Configuration
 * Centralized constants ensuring zero drift across UI and links.
 */

export const TELEGRAM_BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT || 'solaanaaradarbot';
export const TELEGRAM_BOT_ID = '8943169326';
export const TELEGRAM_BOT_URL = `https://t.me/${TELEGRAM_BOT_USERNAME}`;

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1'
    ? 'https://solradar-api.onrender.com'
    : 'http://localhost:3001');
