import { describe, expect, it } from 'vitest';
import {
  FLIGHT_TIME,
  HAND,
  RINGS_PER_ROUND,
  SWAY,
  bottleAt,
  createState,
  step,
  swayAt,
  throwRing,
} from './game';

describe('ring toss', () => {
  it('starts with a full set of rings, a grid of bottles and no score', () => {
    const state = createState();
    expect(state.rings).toBe(RINGS_PER_ROUND);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
    expect(state.bottles).toHaveLength(15);
  });

  it('uses one ring per throw', () => {
    const state = createState();
    expect(throwRing(state, 400, 200)).toBe(true);
    expect(state.rings).toBe(RINGS_PER_ROUND - 1);
    expect(state.ring).toBeDefined();
  });

  it('throws one ring at a time', () => {
    const state = createState();
    throwRing(state, 400, 200);
    expect(throwRing(state, 400, 200)).toBe(false);
    expect(state.rings).toBe(RINGS_PER_ROUND - 1);
  });

  it('cannot throw once the rings run out', () => {
    const state = createState();
    state.rings = 0;
    expect(throwRing(state, 400, 200)).toBe(false);
    expect(state.ring).toBeUndefined();
  });

  it('never throws a ring back towards the player', () => {
    const state = createState();
    throwRing(state, 400, HAND.y + 100);
    expect(state.ring!.toY).toBeLessThanOrEqual(HAND.y);
  });

  it('pushes the throw sideways by the sway of the hand', () => {
    const state = createState();
    state.time = 0.4;
    throwRing(state, 400, 200);
    expect(state.ring!.toX).toBeCloseTo(400 + swayAt(0.4));
    expect(Math.abs(swayAt(0.4))).toBeLessThanOrEqual(SWAY);
  });

  it('scores a ring that lands on a bottle neck', () => {
    const state = createState();
    const bottle = state.bottles[0];
    state.ring = { fromX: HAND.x, fromY: HAND.y, toX: bottle.x, toY: bottle.y, age: 0 };
    step(state, FLIGHT_TIME);
    expect(state.score).toBe(bottle.points);
    expect(bottle.ringed).toBe(1);
    expect(state.ring).toBeUndefined();
  });

  it('scores nothing for a ring that misses every bottle', () => {
    const state = createState();
    state.ring = { fromX: HAND.x, fromY: HAND.y, toX: 20, toY: 450, age: 0 };
    step(state, FLIGHT_TIME);
    expect(state.score).toBe(0);
    expect(state.ring).toBeUndefined();
  });

  it('only scores a ring once it lands', () => {
    const state = createState();
    const bottle = state.bottles[0];
    state.ring = { fromX: HAND.x, fromY: HAND.y, toX: bottle.x, toY: bottle.y, age: 0 };
    step(state, FLIGHT_TIME / 2);
    expect(state.score).toBe(0);
    expect(state.ring).toBeDefined();
  });

  it('scores bottles further back higher', () => {
    const state = createState();
    const back = state.bottles.reduce((a, b) => (b.y < a.y ? b : a));
    const front = state.bottles.reduce((a, b) => (b.y > a.y ? b : a));
    expect(back.points).toBeGreaterThan(front.points);
    expect(back.points).toBe(30);
    expect(front.points).toBe(10);
  });

  it('finds the bottle under a neck and nothing between bottles', () => {
    const state = createState();
    const bottle = state.bottles[0];
    expect(bottleAt(state.bottles, bottle.x + bottle.neck - 1, bottle.y)).toBe(bottle);
    expect(bottleAt(state.bottles, bottle.x + 50, bottle.y)).toBeUndefined();
  });

  it('ends the round when the rings run out and the last ring has landed', () => {
    const state = createState();
    state.rings = 1;
    throwRing(state, 400, 200);
    step(state, FLIGHT_TIME / 2);
    expect(state.phase).toBe('playing');
    step(state, FLIGHT_TIME);
    expect(state.phase).toBe('over');
  });
});
