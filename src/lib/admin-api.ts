// lib/admin-api.ts
// Wraps fetch calls to /api/admin/* routes, automatically attaching
// the current user's Supabase access token as a Bearer header.
// Import this instead of raw fetch in your admin pages.

import { getClient } from "@/lib/supabase/client";

async function getToken(): Promise<string> {
  const supabase = getClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  return session.access_token;
}

async function adminFetch(path: string, init: RequestInit): Promise<Response> {
  const token = await getToken();
  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
}

export async function adminPost<T = unknown>(path: string, body: object): Promise<T> {
  const res = await adminFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

export async function adminPatch<T = unknown>(path: string, body: object): Promise<T> {
  const res = await adminFetch(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json() as Promise<T>;
}