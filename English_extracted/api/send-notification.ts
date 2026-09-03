import type { VercelRequest, VercelResponse } from '@vercel/node';
import { broadcastNotification } from './_lib/broadcast';

/**
 * Call this endpoint yourself (e.g. from a browser bookmarklet, curl, or a
 * scheduled cron job) to push a notification to everyone who has enabled
 * notifications. Protected by NOTIFY_SECRET so randoms can't spam your
 * subscribers.
 *
 * Example:
 *   curl -X POST https://your-app.vercel.app/api/send-notification \
 *     -H "Content-Type: application/json" \
 *     -H "x-notify-secret: <your NOTIFY_SECRET>" \
 *     -d '{"title":"lowkey","body":"Nova misses you 😭 come practice"}'
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const secret = process.env.NOTIFY_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'Server misconfigured: NOTIFY_SECRET is not set' });
    return;
  }
  if (req.headers['x-notify-secret'] !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { title, body, url } = (req.body ?? {}) as { title?: string; body?: string; url?: string };

  try {
    const result = await broadcastNotification(
      title || 'lowkey',
      body || 'Nova has something for you 👀',
      url || '/',
    );
    res.status(200).json(result);
  } catch (err) {
    console.error('Send-notification endpoint error:', err);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
}
