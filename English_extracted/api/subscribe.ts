import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

// We store each subscription under a key derived from its unique endpoint URL,
// and keep a set of all keys so we can list every subscriber when sending.
const SUBSCRIBERS_SET = 'push:subscribers';

function keyFor(endpoint: string): string {
  return `push:sub:${Buffer.from(endpoint).toString('base64url')}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'POST') {
      const subscription = req.body;
      if (!subscription?.endpoint) {
        res.status(400).json({ error: 'Invalid subscription' });
        return;
      }
      const key = keyFor(subscription.endpoint);
      await kv.set(key, subscription);
      await kv.sadd(SUBSCRIBERS_SET, key);
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'DELETE') {
      const { endpoint } = req.body ?? {};
      if (!endpoint) {
        res.status(400).json({ error: 'endpoint is required' });
        return;
      }
      const key = keyFor(endpoint);
      await kv.del(key);
      await kv.srem(SUBSCRIBERS_SET, key);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Subscribe endpoint error:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
}
