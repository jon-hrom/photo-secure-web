export const LEGAL_API = 'https://functions.poehali.dev/ab5aebb2-dfba-4256-9396-4c3adb50a9ea';

export interface LegalDocMeta {
  slug: string;
  title: string;
  version: number;
  sort_order: number;
}

export interface LegalDoc extends LegalDocMeta {
  content: string;
  updated_at?: string;
  requires_consent?: boolean;
}

export async function fetchLegalList(): Promise<LegalDocMeta[]> {
  const res = await fetch(`${LEGAL_API}?action=list`);
  const data = await res.json();
  return data.documents || [];
}

export async function fetchLegalDoc(slug: string): Promise<LegalDoc | null> {
  const res = await fetch(`${LEGAL_API}?action=get&slug=${encodeURIComponent(slug)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.document || null;
}

export async function fetchPendingDocs(userId: string): Promise<LegalDoc[]> {
  const res = await fetch(`${LEGAL_API}?action=pending`, {
    headers: { 'X-User-Id': userId },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.pending || [];
}

export async function acceptDocs(userId: string, slugs: string[]): Promise<boolean> {
  const res = await fetch(LEGAL_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
    body: JSON.stringify({ action: 'accept', slugs }),
  });
  const data = await res.json();
  return !!data.success;
}

export async function adminListDocs(userId: string): Promise<LegalDoc[]> {
  const res = await fetch(`${LEGAL_API}?action=admin_list`, {
    headers: { 'X-User-Id': userId },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents || [];
}

export async function adminPublishDoc(
  userId: string,
  slug: string,
  title: string,
  content: string,
): Promise<{ success: boolean; version?: number; changed?: boolean; error?: string }> {
  const res = await fetch(LEGAL_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
    body: JSON.stringify({ action: 'admin_publish', slug, title, content }),
  });
  return res.json();
}
