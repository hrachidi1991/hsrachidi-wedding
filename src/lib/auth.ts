import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

// Fail-closed: NO built-in fallback secret. If ADMIN_JWT_SECRET is unset, no token
// can be signed or verified, so the admin is simply locked rather than protected by
// a publicly-known default. Set ADMIN_JWT_SECRET in the environment (Vercel).
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || '';
const TOKEN_COOKIE = 'admin_token';

// How long a login lasts before credentials are required again. Default 4 hours;
// override with ADMIN_SESSION_HOURS.
const SESSION_HOURS = Number(process.env.ADMIN_SESSION_HOURS) || 4;
export const SESSION_MAX_AGE_SECONDS = Math.max(60, Math.round(SESSION_HOURS * 3600));

// Admin users. Primary source is ADMIN_USERS — a JSON array of { u, h } where h is a
// bcrypt hash, e.g. [{"u":"admin","h":"$2a$.."},{"u":"suzy","h":"$2a$.."}]. Falls back
// to the single-user ADMIN_USERNAME / ADMIN_PASSWORD_HASH pair when ADMIN_USERS is unset.
type AdminUser = { u: string; h: string };
function loadUsers(): AdminUser[] {
  const raw = process.env.ADMIN_USERS;
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return arr
          .filter((x) => x && typeof x.u === 'string' && typeof x.h === 'string')
          .map((x) => ({ u: x.u.trim(), h: x.h }));
      }
    } catch {
      /* malformed JSON → fall through to single-user */
    }
  }
  const u = process.env.ADMIN_USERNAME;
  const h = process.env.ADMIN_PASSWORD_HASH;
  if (u && h) return [{ u: u.trim(), h }];
  return [];
}
const ADMIN_USERS = loadUsers();

export interface CredCheck {
  ok: boolean;
  user?: string;
}

export async function verifyAdminCredentials(username: string, password: string): Promise<CredCheck> {
  const uname = (username || '').trim();
  const found = ADMIN_USERS.find((x) => x.u === uname);
  if (!found) return { ok: false };
  const ok = await bcrypt.compare(password || '', found.h);
  return { ok, user: ok ? found.u : undefined };
}

export function createAdminToken(user = 'admin'): string {
  if (!JWT_SECRET) throw new Error('ADMIN_JWT_SECRET is not set');
  return jwt.sign({ role: 'admin', user }, JWT_SECRET, {
    expiresIn: SESSION_MAX_AGE_SECONDS,
  });
}

export function verifyAdminToken(token: string): boolean {
  if (!JWT_SECRET) return false;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { role: string };
    return decoded.role === 'admin';
  } catch {
    return false;
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(TOKEN_COOKIE)?.value;
    if (!token) return false;
    return verifyAdminToken(token);
  } catch {
    return false;
  }
}

export function getTokenFromRequest(request: Request): string | null {
  // Check Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  // Check cookie
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(new RegExp(`${TOKEN_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

export function requireAdmin(request: Request): boolean {
  const token = getTokenFromRequest(request);
  if (!token) return false;
  return verifyAdminToken(token);
}
