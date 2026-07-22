/**
 * Tests for services/sensorContext.ts — the block of text appended to every LLM
 * request describing what the wrist unit is currently reading.
 *
 * These exist because the site and ROADMAP.md claim this module is verified.
 * Before this file, that claim rested on a throwaway in-session harness that was
 * never committed — a reviewer who went looking for the evidence found nothing.
 *
 * Run with: npm test        (no framework; node:test + node:assert are built in)
 *
 * The load-bearing assertions here are the HONESTY ones:
 *   - a failed sensor must read "unavailable", never 0 and never a made-up value
 *   - a disconnected bridge must say so, never emit stale readings
 *   - the block must always forbid the model from inventing a heart rate / SpO2
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSensorContext,
  SENSOR_BLOCK_BEGIN,
  SENSOR_BLOCK_END,
} from '../services/sensorContext.ts';
import { DISCONNECTED_VITALS } from '../services/wristVitalsParser.ts';

/** A fully-healthy live snapshot — every sensor reporting. */
function liveVitals(overrides = {}) {
  return {
    ...DISCONNECTED_VITALS,
    connected: true,
    source: 'live',
    tMs: 300,
    bmpOk: true,
    tempC: 21.0,
    pressPa: 101300.2,
    altM: 2.1,
    lisOk: true,
    accelX: 1.8,
    accelY: 1.5,
    accelZ: 1.2,
    accelMagG: 2.62,
    fallDetected: true,
    maxOk: true,
    red: 10249,
    ir: 10398,
    ...overrides,
  };
}

// ── shape ──────────────────────────────────────────────────────────────────

test('block is always delimited, so the model and the UI agree on its bounds', () => {
  for (const vitals of [liveVitals(), DISCONNECTED_VITALS]) {
    const block = buildSensorContext(vitals);
    assert.ok(block.startsWith(SENSOR_BLOCK_BEGIN), 'starts with BEGIN marker');
    assert.ok(block.trimEnd().endsWith(SENSOR_BLOCK_END), 'ends with END marker');
  }
});

// ── all-good input ─────────────────────────────────────────────────────────

test('healthy snapshot reports every derived reading with its qualifier', () => {
  const block = buildSensorContext(liveVitals());

  assert.match(block, /Altitude: 2\.1 m/);
  assert.match(block, /RELATIVE change only — NOT GPS or true elevation/);

  assert.match(block, /Temperature: 21\.0 °C/);
  assert.match(block, /AMBIENT air at the device — NOT body temperature/);

  assert.match(block, /Fall detected: YES/);
  assert.match(block, /not medical-grade/);
});

test('healthy snapshot reports raw signals, labelled non-diagnostic', () => {
  const block = buildSensorContext(liveVitals());

  assert.match(block, /RAW SIGNALS \(non-diagnostic\)/);
  assert.match(block, /Optical counts: red 10249, ir 10398/);
  assert.match(block, /Acceleration magnitude: 2\.62 g \(raw\)/);
});

test('snapshot uptime is carried through so the model knows how fresh it is', () => {
  const block = buildSensorContext(liveVitals({ tMs: 1234 }));
  assert.match(block, /uptime 1234 ms/);
});

test('fall flag renders as YES / no, never as a bare boolean', () => {
  assert.match(buildSensorContext(liveVitals({ fallDetected: true })), /Fall detected: YES/);
  assert.match(buildSensorContext(liveVitals({ fallDetected: false })), /Fall detected: no/);
});

test('the user outranks the sensors, and the block says so', () => {
  const block = buildSensorContext(liveVitals());
  assert.match(block, /if they conflict with what the user reports, the user’s report wins/);
});

// ── the ok:false path — the honesty core ───────────────────────────────────

test('a failed optical sensor reads "unavailable", never 0', () => {
  const block = buildSensorContext(liveVitals({ maxOk: false, red: null, ir: null }));

  assert.match(block, /Optical counts: red unavailable \(sensor read failed\), ir unavailable/);
  assert.doesNotMatch(block, /red 0\b/, 'must not fabricate a zero reading');
  assert.doesNotMatch(block, /ir 0\b/, 'must not fabricate a zero reading');
});

test('a failed barometer reads "unavailable" for both altitude and temperature', () => {
  const block = buildSensorContext(liveVitals({ bmpOk: false, tempC: null, altM: null, pressPa: null }));

  assert.match(block, /Altitude: unavailable \(sensor read failed\)/);
  assert.match(block, /Temperature: unavailable \(sensor read failed\)/);
  assert.doesNotMatch(block, /Altitude: 0\.0 m/);
  assert.doesNotMatch(block, /Temperature: 0\.0 °C/);
});

test('a failed accelerometer reads "unavailable" for magnitude', () => {
  const block = buildSensorContext(liveVitals({ lisOk: false, accelMagG: null }));
  assert.match(block, /Acceleration magnitude: unavailable \(sensor read failed\)/);
  assert.doesNotMatch(block, /magnitude: 0\.00 g/);
});

test('one dead sensor does not suppress the others', () => {
  const block = buildSensorContext(liveVitals({ maxOk: false, red: null, ir: null }));

  assert.match(block, /Altitude: 2\.1 m/, 'barometer still reported');
  assert.match(block, /Acceleration magnitude: 2\.62 g/, 'accelerometer still reported');
  assert.match(block, /unavailable/, 'and the dead one is named');
});

test('every sensor failing still yields a complete, honest block', () => {
  // With the accelerometer dead the firmware reports fall_detected:false — it
  // gates the flag on a valid read (firmware/main.c:91-92), so this snapshot is
  // the one a real wrist unit would produce with all three sensors down.
  const block = buildSensorContext(
    liveVitals({
      bmpOk: false, tempC: null, altM: null, pressPa: null,
      lisOk: false, accelMagG: null, fallDetected: false,
      maxOk: false, red: null, ir: null,
    })
  );

  assert.equal(block.match(/unavailable/g).length, 5, 'alt, temp, red, ir, accel');
  assert.ok(block.startsWith(SENSOR_BLOCK_BEGIN));
  assert.match(block, /Fall detected: no/, 'fall flag is a boolean, not a reading');
});

// ── disconnected / no data ─────────────────────────────────────────────────

test('a disconnected bridge yields an explicit no-data block, not stale readings', () => {
  const block = buildSensorContext(DISCONNECTED_VITALS);

  assert.match(block, /No sensor data available: the wrist unit is not connected/);
  assert.match(block, /no link to the sensor bridge/);
  assert.match(block, /Base all guidance on the user’s own report/);
  assert.doesNotMatch(block, /DERIVED READINGS/, 'no readings section at all');
  assert.doesNotMatch(block, /Optical counts/, 'no invented raw signals');
});

test('"connecting" is distinguished from "disconnected" in the stated reason', () => {
  const connecting = buildSensorContext({ ...DISCONNECTED_VITALS, source: 'connecting' });
  assert.match(connecting, /link established but no telemetry received yet/);

  const disconnected = buildSensorContext({ ...DISCONNECTED_VITALS, source: 'disconnected' });
  assert.match(disconnected, /no link to the sensor bridge/);
});

test('a live link with no data line yet is treated as no data, not as zeroes', () => {
  const block = buildSensorContext(liveVitals({ tMs: null }));

  assert.match(block, /No sensor data available/);
  assert.doesNotMatch(block, /uptime null/);
  assert.doesNotMatch(block, /DERIVED READINGS/);
});

// ── the hard rule: no HR / SpO2, ever ──────────────────────────────────────

test('the block always forbids inferring heart rate or SpO2 from raw counts', () => {
  const block = buildSensorContext(liveVitals());

  assert.match(block, /No pulse-extraction algorithm runs on this device/);
  assert.match(block, /heart rate and blood-oxygen saturation \(SpO2\) are NOT available/);
  assert.match(block, /must not be inferred from these numbers/);
});

test('the block never states a heart rate, pulse or SpO2 value', () => {
  for (const vitals of [liveVitals(), liveVitals({ maxOk: false, red: null, ir: null }), DISCONNECTED_VITALS]) {
    const block = buildSensorContext(vitals);
    // Any "<number> bpm", "heart rate: <number>", "SpO2: <number>" would be a value.
    assert.doesNotMatch(block, /\d+\s*bpm/i, 'no BPM value');
    assert.doesNotMatch(block, /heart rate[:\s]+\d/i, 'no heart-rate value');
    assert.doesNotMatch(block, /spo2[:\s]+\d/i, 'no SpO2 value');
    assert.doesNotMatch(block, /pulse[:\s]+\d/i, 'no pulse value');
  }
});
