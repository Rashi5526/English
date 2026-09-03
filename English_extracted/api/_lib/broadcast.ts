import { kv } from '@vercel/kv';
import webpush from 'web-push';

const SUBSCRIBERS_SET = 'push:subscribers';

export async function broadcastNotification(title: string, body: string, url = '/') {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:example@example.com';
  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('VAPID keys are not set');
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const payload = JSON.stringify({ title, body, url });
  const keys = (await kv.smembers(SUBSCRIBERS_SET)) as string[];
  let sent = 0;
  let removed = 0;

  await Promise.all(
    keys.map(async key => {
      const subscription = await kv.get(key);
      if (!subscription) return;
      try {
        await webpush.sendNotification(subscription as any, payload);
        sent++;
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await kv.del(key);
          await kv.srem(SUBSCRIBERS_SET, key);
          removed++;
        } else {
          console.error('Push send error for', key, err);
        }
      }
    }),
  );

  return { sent, removed, totalSubscribers: keys.length };
}
