const KEY = 'chat_copy_buffer_v1';
const TTL_MS = 60 * 60 * 1000; // 1 час

interface BufferItem {
  text: string;
  expires_at: number;
}

function read(): BufferItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as BufferItem[];
    const now = Date.now();
    return arr.filter((x) => x && x.expires_at > now);
  } catch {
    return [];
  }
}

function write(items: BufferItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(-20)));
  } catch {
    /* quota */
  }
}

export async function copyTextToBuffer(text: string): Promise<void> {
  if (!text) return;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
  } catch { /* noop */ }

  const items = read();
  items.push({ text, expires_at: Date.now() + TTL_MS });
  write(items);
}

export function getBufferItems(): { text: string; expires_at: number }[] {
  return read();
}

export function clearBuffer(): void {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}
