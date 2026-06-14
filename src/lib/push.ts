const PUSH_URL = 'https://functions.poehali.dev/70daada3-63aa-4edd-99cd-dbf9190c733c';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function getVapidKey(): Promise<string | null> {
  try {
    const res = await fetch(`${PUSH_URL}?action=vapid`);
    const data = await res.json();
    return data.public_key || null;
  } catch {
    return null;
  }
}

export async function registerPush(userId: string | number): Promise<boolean> {
  if (!isPushSupported() || !userId) return false;

  try {
    if (Notification.permission === 'denied') return false;
    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return false;
    }

    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const vapid = await getVapidKey();
    if (!vapid) return false;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
    }

    await fetch(PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': String(userId) },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    return true;
  } catch (e) {
    console.warn('[push] register failed', e);
    return false;
  }
}
