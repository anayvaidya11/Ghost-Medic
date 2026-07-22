/**
 * Tests for services/fallTrigger.ts — decides when a fall reading should make
 * the assistant speak up on its own, without the user typing anything.
 *
 * The whole module exists to answer one question correctly: the wristband
 * reports ten times a second, so a single fall produces a run of "fall = true"
 * readings, and a looping replay produces that run over and over. Firing on each
 * of them would ask the model forty questions about one stumble. These tests
 * pin the three guards that prevent it: rising edge, cooldown, suppression.
 *
 * Run with: npm test        (no framework; node:test + node:assert are built in)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createFallTrigger, FALL_TRIGGER_COOLDOWN_MS } from '../services/fallTrigger.ts';

const COOLDOWN = 1000; // short cooldown keeps the tests fast and readable

/** Feed a list of fall readings 100 ms apart (the wristband's real 10 Hz cadence). */
function feed(trigger, readings, { startMs = 0, suppressed = false, stepMs = 100 } = {}) {
  let fires = 0;
  readings.forEach((fall, i) => {
    if (trigger.update(fall, startMs + i * stepMs, suppressed)) fires++;
  });
  return fires;
}

// ── the default is the documented one ──────────────────────────────────────

test('default cooldown is the 30 s documented in ARCHITECTURE.md and on the site', () => {
  assert.equal(FALL_TRIGGER_COOLDOWN_MS, 30_000);
});

// ── rising edge ────────────────────────────────────────────────────────────

test('one fall fires exactly once, however many readings it spans', () => {
  const trigger = createFallTrigger({ cooldownMs: COOLDOWN });
  // A real fall holds the flag high for several 10 Hz readings in a row.
  const fires = feed(trigger, [false, true, true, true, true, false]);
  assert.equal(fires, 1, 'one fall, one question — not one per reading');
});

test('the fire lands on the first true reading, not a later one', () => {
  const trigger = createFallTrigger({ cooldownMs: COOLDOWN });

  assert.equal(trigger.update(false, 0, false), false);
  assert.equal(trigger.update(true, 100, false), true, 'fires on the transition');
  assert.equal(trigger.update(true, 200, false), false, 'still the same fall');
});

test('a stream that starts already-true still fires (a fall in progress counts)', () => {
  const trigger = createFallTrigger({ cooldownMs: COOLDOWN });
  assert.equal(trigger.update(true, 0, false), true);
});

test('quiet readings never fire', () => {
  const trigger = createFallTrigger({ cooldownMs: COOLDOWN });
  assert.equal(feed(trigger, [false, false, false, false, false]), 0);
});

// ── cooldown ───────────────────────────────────────────────────────────────

test('a second fall inside the cooldown is ignored', () => {
  const trigger = createFallTrigger({ cooldownMs: COOLDOWN });

  assert.equal(trigger.update(true, 0, false), true, 'first fall fires');
  assert.equal(trigger.update(false, 100, false), false);
  assert.equal(trigger.update(true, 200, false), false, 'second fall is inside the cooldown');
});

test('a fall after the cooldown expires fires again', () => {
  const trigger = createFallTrigger({ cooldownMs: COOLDOWN });

  assert.equal(trigger.update(true, 0, false), true);
  assert.equal(trigger.update(false, 100, false), false);
  assert.equal(trigger.update(true, COOLDOWN, false), true, 'cooldown boundary is inclusive');
});

test('a looping replay of the sample capture fires once per cooldown, not once per loop', () => {
  // bridge/sample.ndjson replayed with --loop: four data lines at 10 Hz, one of
  // which carries fall_detected = true. Each loop is a fresh rising edge.
  const LOOP = [false, false, true, false];
  const trigger = createFallTrigger({ cooldownMs: COOLDOWN });

  let fires = 0;
  let nowMs = 0;
  for (let loop = 0; loop < 30; loop++) {
    for (const fall of LOOP) {
      if (trigger.update(fall, nowMs, false)) fires++;
      nowMs += 100; // 10 Hz
    }
  }

  // 30 loops x 400 ms = 12 s of replay and 30 rising edges. With a 1 s cooldown
  // an edge only gets through every third loop (edges land 400 ms apart), so the
  // model is asked 10 times instead of 30 — and at the real 30 s cooldown, once.
  assert.equal(fires, 10, 'one question per cooldown window, not one per loop');
});

// ── suppression ────────────────────────────────────────────────────────────

test('a fall while suppressed is dropped, not queued for later', () => {
  const trigger = createFallTrigger({ cooldownMs: COOLDOWN });

  assert.equal(trigger.update(true, 0, true), false, 'suppressed: does not fire');
  assert.equal(trigger.update(true, 100, false), false, 'and does not fire late on a stale true');
});

test('suppression does not burn the cooldown, so the next real fall still fires', () => {
  const trigger = createFallTrigger({ cooldownMs: COOLDOWN });

  assert.equal(trigger.update(true, 0, true), false, 'suppressed edge consumed');
  assert.equal(trigger.update(false, 100, false), false);
  assert.equal(trigger.update(true, 200, false), true, 'next fall fires immediately');
});

test('un-suppressing mid-fall does not fire until the next fall begins', () => {
  const trigger = createFallTrigger({ cooldownMs: COOLDOWN });

  assert.equal(trigger.update(true, 0, true), false);
  assert.equal(trigger.update(true, 100, false), false, 'same fall, already consumed');
  assert.equal(trigger.update(false, 200, false), false);
  assert.equal(trigger.update(true, 300, false), true, 'a new fall');
});

// ── independence ───────────────────────────────────────────────────────────

test('each trigger keeps its own state', () => {
  const a = createFallTrigger({ cooldownMs: COOLDOWN });
  const b = createFallTrigger({ cooldownMs: COOLDOWN });

  assert.equal(a.update(true, 0, false), true);
  assert.equal(b.update(true, 0, false), true, 'b is not gated by a');
});
