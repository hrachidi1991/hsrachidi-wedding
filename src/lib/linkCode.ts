// Opaque short codes for invitation links.
//
// Instead of exposing the sequential group code in a link (…/?g=b001), we encode
// it as a short opaque token (…/?g=x1k4p). It's a stateless keyed bijection over
// the small id space — no DB column, no lookup table, fully reversible on the
// server. Plaintext …/?g=b001 links still resolve too, so links already sent keep
// working. (This is obfuscation, not cryptographic secrecy — the goal is that a
// shared link doesn't reveal or invite guessing of other groups' codes.)

const P = 999983;   // prime modulus (< 36^4, so codes are always 4 base36 chars)
const A = 387433;   // multiplier (coprime to P → bijective)
const B = 573817;   // additive offset
const MARKER = 'x'; // leading char; keeps short codes disjoint from [bg]### group codes

function modInverse(a: number, m: number): number {
  let [old_r, r] = [a % m, m];
  let [old_s, s] = [1, 0];
  while (r !== 0) {
    const q = Math.floor(old_r / r);
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  return ((old_s % m) + m) % m;
}

const AINV = modInverse(A, P);

// 'b072' -> 72, 'g101' -> 1101; null for anything not a standard [bg]### code.
function idFromCode(groupCode: string): number | null {
  const m = /^([bg])(\d{3})$/i.exec(groupCode);
  if (!m) return null;
  const num = parseInt(m[2], 10);
  return (m[1].toLowerCase() === 'g' ? 1000 : 0) + num;
}

function codeFromId(id: number): string | null {
  const side = id >= 1000 ? 'g' : 'b';
  const num = id % 1000;
  if (num < 1 || num > 999) return null;
  return side + String(num).padStart(3, '0');
}

// groupCode -> short code. Non-standard codes are returned unchanged (still usable as plaintext).
export function encodeGroupCode(groupCode: string): string {
  const id = idFromCode(groupCode);
  if (id === null) return groupCode;
  const n = (A * id + B) % P;
  return MARKER + n.toString(36).padStart(4, '0');
}

// short code -> candidate groupCode, or null if the input isn't a short code.
// (Existence is confirmed by the caller's DB lookup.)
export function decodeGroupCode(code: string): string | null {
  if (!code) return null;
  const m = new RegExp('^' + MARKER + '([0-9a-z]{4})$', 'i').exec(code);
  if (!m) return null;
  const n = parseInt(m[1], 36);
  if (Number.isNaN(n) || n >= P) return null;
  const id = (((n - B) % P + P) % P) * AINV % P;
  return codeFromId(id);
}
