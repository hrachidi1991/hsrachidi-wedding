// ─────────────────────────────────────────────────────────────────────────
// Venue seating geometry — traced from the Blossom floor plan for Pleine Nature.
// The real plan: a central stage, a PINWHEEL of spiral/comma curved chair banks
// around it, three round tables (left, right, bottom-centre), two front theater
// blocks, all inside an octagonal hall. Positions are fixed here (SVG space);
// the database stores only which Guest is assigned to each seat `code`.
// Total = 240 chairs (matches the plan's stated capacity).
// ─────────────────────────────────────────────────────────────────────────

export interface SeatDef {
  code: string;
  section: 'arc' | 'table' | 'theater';
  zone: string;
  num: number;
  x: number;
  y: number;
  rot: number; // chair facing angle (deg)
}

export const VIEWBOX = { w: 1100, h: 880 };
export const STAGE = { x: 520, y: 400, r: 80 };
// Octagonal hall outline (points string for an SVG <polygon>)
export const ROOM = '250,300 500,175 790,175 1015,360 1015,545 865,715 300,795 150,545';

const D = Math.PI / 180;
const r1 = (v: number) => Math.round(v * 10) / 10;
const face = (x: number, y: number, cx: number, cy: number) => r1(Math.atan2(cy - y, cx - x) * 180 / Math.PI + 90);

// A spiral/comma curved bank (Archimedean spiral piece), rotated into the pinwheel.
function spiralArm(rot: number, th0: number, th1: number, r0: number, r1n: number, n: number, code: string, zone: string, out: SeatDef[]) {
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const th = (th0 + (th1 - th0) * t + rot) * D;
    const r = r0 + (r1n - r0) * t;
    const x = STAGE.x + r * Math.cos(th);
    const y = STAGE.y + r * Math.sin(th);
    out.push({ code: `${code}-${String(i + 1).padStart(2, '0')}`, section: 'arc', zone, num: i + 1, x: r1(x), y: r1(y), rot: face(x, y, STAGE.x, STAGE.y) });
  }
}

// A full ring of chairs around a round table.
function ring(cx: number, cy: number, r: number, n: number, code: string, zone: string, out: SeatDef[]) {
  for (let i = 0; i < n; i++) {
    const a = (i / n * 360 - 90) * D;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    out.push({ code: `${code}-${String(i + 1).padStart(2, '0')}`, section: 'table', zone, num: i + 1, x: r1(x), y: r1(y), rot: r1(Math.atan2(cy - y, cx - x) * 180 / Math.PI + 90) });
  }
}

// A straight theater block (grid) facing the stage (up).
function block(x0: number, y0: number, cols: number, rows: number, dx: number, dy: number, code: string, zone: string, out: SeatDef[]) {
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    out.push({ code: `${code}-${String(r * cols + c + 1).padStart(2, '0')}`, section: 'theater', zone, num: r * cols + c + 1, x: r1(x0 + c * dx), y: r1(y0 + r * dy), rot: 0 });
  }
}

// Round-table decorations (for the disc drawn under each ring)
export const TABLES = [
  { n: 1, cx: STAGE.x - 335, cy: STAGE.y + 10, r: 24, seats: 19, zone: 'Left Table' },
  { n: 2, cx: STAGE.x + 335, cy: STAGE.y + 10, r: 24, seats: 19, zone: 'Right Table' },
  { n: 3, cx: STAGE.x, cy: STAGE.y + 212, r: 22, seats: 16, zone: 'Center Table' },
];

function build(): SeatDef[] {
  const s: SeatDef[] = [];
  // Pinwheel — 5 spiral comma banks (inner + outer curved rows), rotated 72° apart
  for (let i = 0; i < 5; i++) {
    const rot = i * 72;
    spiralArm(rot, -72, 72, 112, 149, 12, `A${i + 1}`, `Bank ${i + 1} · Inner`, s);
    spiralArm(rot, -76, 76, 156, 193, 14, `B${i + 1}`, `Bank ${i + 1} · Outer`, s);
  }
  // Three round tables
  TABLES.forEach((t) => ring(t.cx, t.cy, 50, t.seats, `T${t.n}`, t.zone, s));
  // Two front theater blocks (bottom-left, bottom-right), facing the stage
  block(STAGE.x - 250, STAGE.y + 296, 7, 4, 26, 25, 'FL', 'Front Left', s);
  block(STAGE.x + 74, STAGE.y + 296, 7, 4, 26, 25, 'FR', 'Front Right', s);
  return s;
}

export const SEATS: SeatDef[] = build();
export const SEAT_COUNT = SEATS.length;
export const SEAT_BY_CODE: Record<string, SeatDef> = Object.fromEntries(SEATS.map((x) => [x.code, x]));
