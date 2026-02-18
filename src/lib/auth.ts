import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'fallback-dev-secret-change-me';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const TOKEN_COOKIE = 'admin_token';

export async function verifyAdminCredentials(username: string, password: string): Promise<boolean> {
  if (username !== ADMIN_USERNAME) return false;
  if (!ADMIN_PASSWORD_HASH) {
    // Dev fallback: if no hash set, accept "admin123"
    return password === 'admin123';
  }
  return bcrypt.compare(password, ADMIN_PASSWORD_HASH);
}

export function createAdminToken(): string {
  return jwt.sign({ role: 'admin', iat: Math.floor(Date.now() / 1000) }, JWT_SECRET, {
    expiresIn: '7d',
  });
}

export function verifyAdminToken(token: string): boolean {
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
