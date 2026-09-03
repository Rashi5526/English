// Client-side push notification helpers.
// The VAPID public key is safe to expose in the browser (it's the "public" half).
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// iOS Safari only supports web push for installed (home-screen) PWAs, not
// for the app running inside a normal Safari tab.
export function isRunningAsInstalledApp(): boolean {
  const isStandaloneDisplay = window.matchMedia('(display-mode: standalone)').matches;
  const isIosStandalone = (navigator as any).standalone === true; // iOS Safari flag
  return isStandaloneDisplay || isIosStandalone;
}

export type PushStatus = 'unsupported' | 'needs-install' | 'denied' | 'subscribed' | 'not-subscribed';

export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported';

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIos && !isRunningAsInstalledApp()) return 'needs-install';

  if (Notification.permission === 'denied') return 'denied';

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  return existing ? 'subscribed' : 'not-subscribed';
}

export async function subscribeToPush(): Promise<void> {
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('Missing VITE_VAPID_PUBLIC_KEY. Set it in your environment variables.');
  }
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported on this browser.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
  });

  const res = await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  });

  if (!res.ok) {
    throw new Error('Failed to save your subscription on the server.');
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await fetch('/api/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });

  await subscription.unsubscribe();
}
