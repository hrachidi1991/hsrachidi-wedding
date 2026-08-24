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

// Roles: "admin" = full access; "hostess" = seat finder + mark guests present;
// "viewer" = seat finder, read-only.
export type Role = 'admin' | 'hostess' | 'viewer';

// Admin users. Primary source is ADMIN_USERS — a JSON array of { u, h } (optionally
// { u, h, role }) where h is a bcrypt hash. Falls back to ADMIN_USERNAME / ADMIN_PASSWORD_HASH.
type AdminUser = { u: string; h: string; role: Role };

// Low-privilege, deliberately-shared event-staff logins (seat finder / check-in only).
// Override in production by setting the ROLE_USERS env var to a JSON array of {u,h,role}.
const DEFAULT_ROLE_USERS: AdminUser[] = [
  { u: 'User', h: '$2a$10$/HaRR57q7KNBSSRP.zGieuC9oU1VWIs0IMS7ijWD91ZxpLSg1UrJS', role: 'viewer' },   // pw 1234
  { u: 'Sorelle', h: '$2a$10$9hNek7.T60Az.cpcNSQ1TOp3HS3/iLauBxdjTRl3ReM.dC1svkFLq', role: 'hostess' }, // pw 12345
];

function parseUsers(raw: string | undefined, defaultRole: Role): AdminUser[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.u === 'string' && typeof x.h === 'string')
      .map((x) => ({ u: x.u.trim(), h: x.h, role: (x.role as Role) || defaultRole }));
  } catch {
    return [];
  }
}

function loadUsers(): AdminUser[] {
  let admins = parseUsers(process.env.ADMIN_USERS, 'admin');
  if (admins.length === 0) {
    const u = process.env.ADMIN_USERNAME;
    const h = process.env.ADMIN_PASSWORD_HASH;
    if (u && h) admins = [{ u: u.trim(), h, role: 'admin' }];
  }
  const roleUsers = process.env.ROLE_USERS ? parseUsers(process.env.ROLE_USERS, 'viewer') : DEFAULT_ROLE_USERS;
  // Admin entries win over any same-named role user.
  const adminNames = new Set(admins.map((a) => a.u.toLowerCase()));
  return [...admins, ...roleUsers.filter((r) => !adminNames.has(r.u.toLowerCase()))];
}
const ALL_USERS = loadUsers();

export interface CredCheck {
  ok: boolean;
  user?: string;
  role?: Role;
}

export async function verifyAdminCredentials(username: string, password: string): Promise<CredCheck> {
  // Username match is case-insensitive so "User"/"user", "Suzy"/"suzy" all work; also
  // accept the common alternate spelling "suzi".
  let uname = (username || '').trim().toLowerCase();
  if (uname === 'suzi') uname = 'suzy';
  const found = ALL_USERS.find((x) => x.u.toLowerCase() === uname);
  if (!found) return { ok: false };
  const ok = await bcrypt.compare(password || '', found.h);
  return ok ? { ok: true, user: found.u, role: found.role } : { ok: false };
}

export function createAdminToken(user = 'admin', role: Role = 'admin'): string {
  if (!JWT_SECRET) throw new Error('ADMIN_JWT_SECRET is not set');
  return jwt.sign({ role, user }, JWT_SECRET, { expiresIn: SESSION_MAX_AGE_SECONDS });
}

// Decode + verify a token, returning its role/user (or null if invalid).
export function decodeToken(token: string): { role: Role; user: string } | null {
  if (!JWT_SECRET) return null;
  try {
    const d = jwt.verify(token, JWT_SECRET) as { role?: string; user?: string };
    const role = (d.role as Role) || 'admin';
    return { role, user: d.user || '' };
  } catch {
    return null;
  }
}

// True only for a valid ADMIN token (used by admin-only mutations).
export function verifyAdminToken(token: string): boolean {
  return decodeToken(token)?.role === 'admin';
}

export async function isAdminAuthenticated(): Promise<boolean> {
  return (await getSessionRole()) === 'admin';
}

// The role of the current session cookie (any role), or null if not signed in.
export async function getSessionRole(): Promise<Role | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(TOKEN_COOKIE)?.value;
    if (!token) return null;
    return decodeToken(token)?.role ?? null;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(new RegExp(`${TOKEN_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

// Admin-only guard (mutations). Unchanged behaviour.
export function requireAdmin(request: Request): boolean {
  const token = getTokenFromRequest(request);
  if (!token) return false;
  return verifyAdminToken(token);
}

// Guard allowing any of the given roles; returns the role (or null if not allowed).
export function requireRole(request: Request, roles: Role[]): Role | null {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  const role = decodeToken(token)?.role;
  return role && roles.includes(role) ? role : null;
}
