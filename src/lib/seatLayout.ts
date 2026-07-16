// ─────────────────────────────────────────────────────────────────────────
// Venue seating geometry — traced from the Blossom floor plan for Pleine Nature.
// A central stage, a pinwheel of curved chair rows in 6 sectors, three round
// tables, and front theater rows. Positions are fixed here (in SVG space); the
// database only stores which Guest is assigned to each seat `code`.
// Total ≈ 240 chairs (matches the plan's stated capacity).
// ─────────────────────────────────────────────────────────────────────────

export interface SeatDef {
  code: string;      // stable id, e.g. "A1-05" — the DB key
  section: 'arc' | 'table' | 'theater';
  zone: string;      // human group, e.g. "Sector 1 · Inner", "Table 2", "Front Row 3"
  num: number;       // seat number within its zone
  x: number;
  y: number;
  rot: number;       // chair facing angle (deg), oriented toward the stage
}

export const VIEWBOX = { w: 1000, h: 800 };
export const STAGE = { x: 500, y: 390, r: 95 };

const D = Math.PI / 180;
const r1 = (v: number) => Math.round(v * 10) / 10;
const faceRot = (x: number, y: number, cx: number, cy: number) =>
  r1(Math.atan2(cy - y, cx - x) * 180 / Math.PI + 90);

function arc(
  cx: number, cy: number, r: number, a0: number, a1: number, n: number,
  code: string, zone: string, section: SeatDef['section'], out: SeatDef[]
) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const a = (a0 + (a1 - a0) * t) * D;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    out.push({ code: `${code}-${String(i + 1).padStart(2, '0')}`, section, zone, num: i + 1, x: r1(x), y: r1(y), rot: faceRot(x, y, STAGE.x, STAGE.y) });
  }
}

function ring(
  cx: number, cy: number, r: number, n: number,
  code: string, zone: string, out: SeatDef[]
) {
  for (let i = 0; i < n; i++) {
    const a = (i / n * 360 - 90) * D;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    out.push({ code: `${code}-${String(i + 1).padStart(2, '0')}`, section: 'table', zone, num: i + 1, x: r1(x), y: r1(y), rot: r1(Math.atan2(cy - y, cx - x) * 180 / Math.PI + 90) });
  }
}

// Round-table decorations (for drawing the table disc under its ring of chairs)
export const TABLES = [30, 150, 270].map((ang, k) => ({
  n: k + 1,
  cx: r1(STAGE.x + 300 * Math.cos(ang * D)),
  cy: r1(STAGE.y + 300 * Math.sin(ang * D)),
  r: 26,
}));

function build(): SeatDef[] {
  const s: SeatDef[] = [];
  // Pinwheel — 6 sectors, each an inner + outer curved row facing the stage
  for (let i = 0; i < 6; i++) {
    const B = -90 + i * 60;
    arc(STAGE.x, STAGE.y, 165, B - 24, B + 24, 10, `A${i + 1}`, `Sector ${i + 1} · Inner`, 'arc', s);
    arc(STAGE.x, STAGE.y, 210, B - 26, B + 26, 12, `B${i + 1}`, `Sector ${i + 1} · Outer`, 'arc', s);
  }
  // Three round tables
  TABLES.forEach((t) => ring(t.cx, t.cy, 50, 18, `T${t.n}`, `Table ${t.n}`, s));
  // Front theater rows (bottom, facing the stage)
  arc(STAGE.x, STAGE.y, 255, 64, 116, 16, 'F1', 'Front Row 1', 'theater', s);
  arc(STAGE.x, STAGE.y, 292, 62, 118, 18, 'F2', 'Front Row 2', 'theater', s);
  arc(STAGE.x, STAGE.y, 329, 60, 120, 20, 'F3', 'Front Row 3', 'theater', s);
  return s;
}

export const SEATS: SeatDef[] = build();
export const SEAT_COUNT = SEATS.length;
export const SEAT_BY_CODE: Record<string, SeatDef> = Object.fromEntries(SEATS.map((x) => [x.code, x]));
