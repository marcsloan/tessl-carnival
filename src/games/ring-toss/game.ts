import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const RINGS_PER_ROUND = 10;
/** Seconds a ring spends in the air. */
export const FLIGHT_TIME = 0.6;
export const HAND = { x: WIDTH / 2, y: HEIGHT - 40 } as const;
/** How far, in pixels, the throwing hand sways either side of the aim. */
export const SWAY = 40;
/** Seconds for one full sway of the hand. */
const SWAY_PERIOD = 1.6;
/** Back row first. Bottles further back are smaller and score more. */
const ROWS = [
  { y: 120, neck: 8, points: 30 },
  { y: 200, neck: 10, points: 20 },
  { y: 280, neck: 12, points: 10 },
];
const BOTTLES_PER_ROW = 5;
const BOTTLE_SPACING = 100;

export interface Bottle {
  x: number;
  y: number;
  /** How close, in pixels, a ring's centre must land to the neck to score. */
  neck: number;
  points: number;
  /** Rings that have landed on this bottle this round. */
  ringed: number;
}

export interface Ring {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Seconds since the throw. */
  age: number;
}

export interface Landing {
  x: number;
  y: number;
  hit: boolean;
  age: number;
}

export interface RingTossState {
  bottles: Bottle[];
  ring: Ring | undefined;
  landings: Landing[];
  rings: number;
  score: number;
  /** Seconds since the round started, which drives the hand's sway. */
  time: number;
  phase: 'playing' | 'over';
}

export function createState(): RingTossState {
  const left = WIDTH / 2 - (BOTTLE_SPACING * (BOTTLES_PER_ROW - 1)) / 2;
  const bottles = ROWS.flatMap((row) =>
    Array.from({ length: BOTTLES_PER_ROW }, (_, i) => ({
      x: left + BOTTLE_SPACING * i,
      y: row.y,
      neck: row.neck,
      points: row.points,
      ringed: 0,
    })),
  );
  return {
    bottles,
    ring: undefined,
    landings: [],
    rings: RINGS_PER_ROUND,
    score: 0,
    time: 0,
    phase: 'playing',
  };
}

/** How far the hand has swayed from the aim at `time`, in pixels. */
export function swayAt(time: number): number {
  return Math.sin((time / SWAY_PERIOD) * Math.PI * 2) * SWAY;
}

/** The bottle whose neck a ring landing at (x, y) rings, if any. */
export function bottleAt(bottles: readonly Bottle[], x: number, y: number): Bottle | undefined {
  return bottles.find((b) => Math.hypot(x - b.x, y - b.y) <= b.neck);
}

/**
 * Throws one ring towards the aim point, pushed sideways by the hand's sway.
 * Only one ring flies at a time. Returns false if nothing was thrown.
 */
export function throwRing(state: RingTossState, aimX: number, aimY: number): boolean {
  if (state.phase !== 'playing' || state.rings === 0 || state.ring) return false;
  state.ring = {
    fromX: HAND.x,
    fromY: HAND.y,
    toX: aimX + swayAt(state.time),
    toY: Math.min(aimY, HAND.y),
    age: 0,
  };
  state.rings -= 1;
  return true;
}

/** Advances the game by `dt` seconds. */
export function step(state: RingTossState, dt: number): void {
  state.time += dt;

  const ring = state.ring;
  if (ring) {
    ring.age += dt;
    if (ring.age >= FLIGHT_TIME) {
      const bottle = bottleAt(state.bottles, ring.toX, ring.toY);
      if (bottle) {
        state.score += bottle.points;
        bottle.ringed += 1;
      }
      state.landings.push({ x: ring.toX, y: ring.toY, hit: bottle !== undefined, age: 0 });
      state.ring = undefined;
    }
  }

  for (const landing of state.landings) landing.age += dt;
  state.landings = state.landings.filter((l) => l.age < 0.5);

  if (state.rings === 0 && !state.ring) state.phase = 'over';
}

/** Where a ring in flight is now, with a little height for the arc. */
export function ringPosition(ring: Ring): { x: number; y: number; scale: number } {
  const t = Math.min(ring.age / FLIGHT_TIME, 1);
  const lift = Math.sin(t * Math.PI) * 80;
  return {
    x: ring.fromX + (ring.toX - ring.fromX) * t,
    y: ring.fromY + (ring.toY - ring.fromY) * t - lift,
    // Rings shrink as they fly away from the player.
    scale: 1 - 0.4 * t,
  };
}

function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.strokeStyle = theme.colors.accent;
  ctx.lineWidth = 4 * scale;
  ctx.beginPath();
  ctx.ellipse(x, y, 18 * scale, 7 * scale, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function draw(ctx: CanvasRenderingContext2D, state: RingTossState, aim: { x: number; y: number }) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // Shelves, then the bottles standing on them, back row first.
  for (const row of ROWS) {
    ctx.fillStyle = colors.wood;
    ctx.fillRect(140, row.y + row.neck * 4, WIDTH - 280, 8);
  }
  for (const bottle of state.bottles) {
    const size = bottle.neck;
    ctx.fillStyle = colors.water;
    ctx.fillRect(bottle.x - size * 1.4, bottle.y + size, size * 2.8, size * 3);
    ctx.fillRect(bottle.x - size * 0.4, bottle.y - size * 0.5, size * 0.8, size * 1.6);
    ctx.fillStyle = colors.surface;
    ctx.beginPath();
    ctx.arc(bottle.x, bottle.y, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < bottle.ringed; i++) {
      drawRing(ctx, bottle.x, bottle.y + size * 0.6 + i * 3, size / 14);
    }
  }

  for (const landing of state.landings) {
    ctx.globalAlpha = 1 - landing.age / 0.5;
    ctx.strokeStyle = landing.hit ? colors.accent : colors.danger;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(landing.x, landing.y, 12 + landing.age * 40, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  if (state.ring) {
    const { x, y, scale } = ringPosition(state.ring);
    drawRing(ctx, x, y, scale);
  }

  // The swaying aim marker shows where a ring thrown now would land.
  if (state.phase === 'playing' && !state.ring && state.rings > 0) {
    const x = aim.x + swayAt(state.time);
    const y = Math.min(aim.y, HAND.y);
    ctx.strokeStyle = colors.muted;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 8, y);
    ctx.lineTo(x + 8, y);
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x, y + 8);
    ctx.stroke();
    drawRing(ctx, HAND.x, HAND.y, 1);
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Rings ${state.rings}/${RINGS_PER_ROUND}`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Out of rings! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const ringToss: CarnivalGame = {
  id: 'ring-toss',
  name: 'Ring Toss',
  description: 'Land your rings on the bottle necks. Bottles further back score more.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    const aim = { x: WIDTH / 2, y: HEIGHT / 2 };

    const toCanvas = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
      };
    };
    const onMove = (event: PointerEvent) => Object.assign(aim, toCanvas(event));
    const onDown = (event: PointerEvent) => {
      Object.assign(aim, toCanvas(event));
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      } else {
        throwRing(state, aim.x, aim.y);
      }
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(ringToss.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state, aim);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
    };
  },
};

export default ringToss;
