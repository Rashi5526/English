import type { VercelRequest, VercelResponse } from '@vercel/node';
import { broadcastNotification } from '../_lib/broadcast';

const REMINDERS = [
  'still lowkey slacking on your English? 👀 come talk to Nova',
  "Nova's got nothing to do rn, come chat 💛",
  "quick vibe check — practice a lil English today?",
];

/**
 * Triggered automatically by Vercel Cron (see vercel.json). Vercel signs
 * cron requests with an Authorization: Bearer <CRON_SECRET> header when
 * you set the CRON_SECRET environment variable, so we verify that here
 * instead of a custom header.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const message = REMINDERS[Math.floor(Math.random() * REMINDERS.length)];
    const result = await broadcastNotification('lowkey', message, '/');
    res.status(200).json(result);
  } catch (err) {
    console.error('Cron reminder error:', err);
    res.status(500).json({ error: 'Failed to send reminder' });
  }
}
