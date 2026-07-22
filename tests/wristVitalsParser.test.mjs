/**
 * Tests for services/wristVitalsParser.ts — reads one line of wristband
 * telemetry into the shape the app renders.
 *
 * This is where DATA_FORMAT.md's one real trap lives: when a sensor fails, its
 * numbers are OMITTED from the line entirely — not sent as null, not sent as 0.
 * A parser that reads a missing field as 0 would put a confident, wrong number
 * on screen during exactly the moment a sensor died. These tests hold that line.
 *
 * The reference lines below are copied verbatim from DATA_FORMAT.md, so if the
 * wire format and the parser ever drift apart, this file fails.
 *
 * Run with: npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseWristLine, DISCONNECTED_VITALS } from '../services/wristVitalsParser.ts';

// Verbatim from DATA_FORMAT.md § "Reference lines for testing".
const BOOT_LINE =
  '{"boot":true,"max30102_init":true,"bmp280_init":true,"lis3dh_init":true}';
const REST_LINE =
  '{"t_ms":100,"max30102":{"ok":true,"red":10240,"ir":10390},"bmp280":{"ok":true,"temp_c":21.0,"press_pa":101325.0,"alt_m":0.0},"lis3dh":{"ok":true,"x_g":0.00,"y_g":0.00,"z_g":1.00,"mag_g":1.00},"fall_detected":false}';
const IMPACT_LINE =
  '{"t_ms":300,"max30102":{"ok":true,"red":10249,"ir":10398},"bmp280":{"ok":true,"temp_c":21.0,"press_pa":101300.2,"alt_m":2.1},"lis3dh":{"ok":true,"x_g":1.80,"y_g":1.50,"z_g":1.20,"mag_g":2.62},"fall_detected":true}';
// Verbatim from DATA_FORMAT.md § "the one parser gotcha".
const DEAD_OPTICAL_LINE =
  '{"t_ms":1500,"max30102":{"ok":false},"bmp280":{"ok":true,"temp_c":22.5,"press_pa":101010.2,"alt_m":25.7},"lis3dh":{"ok":true,"x_g":0.01,"y_g":-0.02,"z_g":0.99,"mag_g":0.99},"fall_detected":false}';

// ── the happy path ─────────────────────────────────────────────────────────

test('a healthy line parses every field at its documented precision', () => {
  const v = parseWristLine(REST_LINE);

  assert.equal(v.tMs, 100);
  assert.equal(v.bmpOk, true);
  assert.equal(v.tempC, 21.0);
  assert.equal(v.pressPa, 101325.0);
  assert.equal(v.altM, 0.0);
  assert.equal(v.lisOk, true);
  assert.equal(v.accelMagG, 1.0);
  assert.equal(v.maxOk, true);
  assert.equal(v.red, 10240);
  assert.equal(v.ir, 10390);
  assert.equal(v.fallDetected, false);
});

test('the impact line carries the fall flag and the high-g magnitude', () => {
  const v = parseWristLine(IMPACT_LINE);

  assert.equal(v.fallDetected, true);
  assert.equal(v.accelMagG, 2.62);
  assert.equal(v.altM, 2.1);
});

test('a real reading of zero is preserved, not mistaken for a missing one', () => {
  const v = parseWristLine(REST_LINE);
  assert.equal(v.altM, 0.0, 'sea-level altitude is a real 0');
  assert.notEqual(v.altM, null);
});

// ── the omission gotcha ────────────────────────────────────────────────────

test('a failed sensor yields null, never 0', () => {
  const v = parseWristLine(DEAD_OPTICAL_LINE);

  assert.equal(v.maxOk, false);
  assert.equal(v.red, null, 'missing field must be null, not 0');
  assert.equal(v.ir, null, 'missing field must be null, not 0');
});

test('a failed sensor does not take down the rest of the line', () => {
  const v = parseWristLine(DEAD_OPTICAL_LINE);

  assert.equal(v.bmpOk, true);
  assert.equal(v.tempC, 22.5);
  assert.equal(v.lisOk, true);
  assert.equal(v.accelMagG, 0.99);
});

test('ok:false wins even if the sender contradicts itself and includes values', () => {
  // Not something the firmware emits, but a consumer must not trust a value
  // that its own sensor just declared invalid.
  const v = parseWristLine('{"t_ms":1,"max30102":{"ok":false,"red":999,"ir":999}}');

  assert.equal(v.maxOk, false);
  assert.equal(v.red, null);
  assert.equal(v.ir, null);
});

test('a missing sensor block entirely is not-ok with null readings', () => {
  const v = parseWristLine('{"t_ms":1,"fall_detected":false}');

  assert.equal(v.bmpOk, false);
  assert.equal(v.lisOk, false);
  assert.equal(v.maxOk, false);
  assert.equal(v.altM, null);
  assert.equal(v.accelMagG, null);
  assert.equal(v.red, null);
});

// ── lines that must be rejected ────────────────────────────────────────────

test('the boot line is rejected — it has no t_ms, so it is not a data line', () => {
  assert.equal(parseWristLine(BOOT_LINE), null);
});

test('malformed input is rejected rather than throwing', () => {
  assert.equal(parseWristLine('not json at all'), null);
  assert.equal(parseWristLine(''), null);
  assert.equal(parseWristLine('{"t_ms":'), null, 'a truncated line (mid-transmission)');
  assert.equal(parseWristLine('null'), null);
  assert.equal(parseWristLine('[1,2,3]'), null, 'valid JSON, wrong shape');
  assert.equal(parseWristLine('{"t_ms":"100"}'), null, 't_ms must be a number');
});

// ── no invented vitals ─────────────────────────────────────────────────────

test('the parsed shape has no heart-rate, pulse or SpO2 field to fill in', () => {
  const keys = Object.keys(parseWristLine(REST_LINE));
  for (const banned of ['bpm', 'hr', 'heartRate', 'pulse', 'spo2', 'spO2', 'oxygen']) {
    assert.ok(!keys.includes(banned), `parsed vitals must not expose "${banned}"`);
  }
  assert.deepEqual(
    Object.keys(DISCONNECTED_VITALS).sort(),
    keys.sort(),
    'the disconnected shape and the parsed shape must stay identical'
  );
});

test('optical counts stay raw integers — no scaling, no derived value', () => {
  const v = parseWristLine(IMPACT_LINE);
  assert.equal(v.red, 10249, 'exactly the count on the wire');
  assert.equal(v.ir, 10398, 'exactly the count on the wire');
});
