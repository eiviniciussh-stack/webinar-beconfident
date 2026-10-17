// Admin session (Supabase Auth tokens issued through our own /api/admin/* routes)

export interface AdminSession {
  email: string;
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
}

const KEY = 'bc_admin_session';

export function getSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AdminSession) : null;
  } catch {
    return null;
  }
}

function setSession(s: AdminSession | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

export function logout() {
  setSession(null);
}

export async function login(email: string, password: string): Promise<AdminSession> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Não foi possível entrar.');
  setSession(json);
  return json;
}

let refreshing: Promise<AdminSession | null> | null = null;

async function refresh(): Promise<AdminSession | null> {
  const current = getSession();
  if (!current?.refresh_token) return null;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch('/api/admin/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: current.refresh_token }),
        });
        if (!res.ok) {
          setSession(null);
          return null;
        }
        const next = (await res.json()) as AdminSession;
        setSession(next);
        return next;
      } catch {
        return null;
      } finally {
        setTimeout(() => (refreshing = null), 0);
      }
    })();
  }
  return refreshing;
}

/** Returns a valid access token, refreshing it when it is about to expire. */
export async function getAccessToken(): Promise<string | null> {
  let s = getSession();
  if (!s) return null;
  if (s.expires_at && s.expires_at * 1000 - Date.now() < 60_000) {
    s = await refresh();
  }
  return s?.access_token || null;
}

/** fetch() with the admin Authorization header; retries once after a refresh on 401. */
export async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const withAuth = async (token: string | null) => {
    const headers = new Headers(init.headers || {});
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };
  let res = await withAuth(await getAccessToken());
  if (res.status === 401 && getSession()) {
    const s = await refresh();
    if (s) res = await withAuth(s.access_token);
  }
  if (res.status === 401) {
    setSession(null);
    window.dispatchEvent(new Event('bc-admin-logout'));
  }
  return res;
}
