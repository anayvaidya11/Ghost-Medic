/**
 * SENSOR CONTEXT BUILDER — pure, no React, no I/O (headless-testable).
 *
 * Single responsibility: turn one WristVitals snapshot into the text block that
 * is appended to the LLM prompt (Phase 2 — see ARCHITECTURE.md "Sensor-Aware
 * LLM"). The block is bracket-delimited so the model can see exactly where
 * sensor data starts and ends, and so the UI can show the user the exact bytes
 * the model was given.
 *
 * HONESTY RULES (enforced here, in text the model reads):
 *   - Every value is gated on its sensor's ok/null status. A failed read says
 *     "unavailable" — never a fabricated or zero value.
 *   - Altitude is pressure-derived vs a fixed 101325 Pa sea-level reference —
 *     good for relative change, NOT GPS/true elevation. Stated in the block.
 *   - Temperature is ambient air at the device, NOT body temperature. Stated.
 *   - Optical red/IR are raw photodiode counts; no pulse-extraction algorithm
 *     runs; heart rate and SpO2 are NOT available. Stated, every time.
 *   - Disconnected bridge => an explicit "no sensor data" block, never stale
 *     or invented readings.
 */

import type { WristVitals } from '@services/wristVitalsParser';

export const SENSOR_BLOCK_BEGIN = '[SENSOR CONTEXT — wrist unit telemetry — BEGIN]';
export const SENSOR_BLOCK_END = '[SENSOR CONTEXT — END]';

/** Format a possibly-missing reading; failed reads become "unavailable". */
function reading(value: number | null, format: (v: number) => string): string {
  return value === null ? 'unavailable (sensor read failed)' : format(value);
}

/**
 * Build the sensor-context text block for one vitals snapshot.
 * Always returns a complete, delimited block — including an honest
 * "no sensor data" block when the bridge is disconnected or has no data yet.
 */
export function buildSensorContext(vitals: WristVitals): string {
  if (vitals.source !== 'live' || vitals.tMs === null) {
    return [
      SENSOR_BLOCK_BEGIN,
      'No sensor data available: the wrist unit is not connected.',
      'Reason: ' +
        (vitals.source === 'connecting'
          ? 'link established but no telemetry received yet.'
          : 'no link to the sensor bridge.'),
      'Base all guidance on the user’s own report.',
      SENSOR_BLOCK_END,
    ].join('\n');
  }

  const lines: string[] = [
    SENSOR_BLOCK_BEGIN,
    `Snapshot taken at device uptime ${vitals.tMs} ms. Readings are supplementary;`,
    'if they conflict with what the user reports, the user’s report wins.',
    '',
    'DERIVED READINGS:',
    `- Altitude: ${reading(vitals.altM, (v) => `${v.toFixed(1)} m`)} ` +
      '(pressure-derived vs a fixed 101325 Pa sea-level reference; reliable for ' +
      'RELATIVE change only — NOT GPS or true elevation)',
    `- Temperature: ${reading(vitals.tempC, (v) => `${v.toFixed(1)} °C`)} ` +
      '(AMBIENT air at the device — NOT body temperature)',
    `- Fall detected: ${vitals.fallDetected ? 'YES' : 'no'} ` +
      '(accelerometer free-fall→impact heuristic, not medical-grade)',
    '',
    'RAW SIGNALS (non-diagnostic):',
    `- Optical counts: red ${reading(vitals.red, String)}, ir ${reading(vitals.ir, String)}. ` +
      'These are raw photodiode counts from the optical sensor. No pulse-extraction ' +
      'algorithm runs on this device: heart rate and blood-oxygen saturation (SpO2) ' +
      'are NOT available and must not be inferred from these numbers.',
    `- Acceleration magnitude: ${reading(vitals.accelMagG, (v) => `${v.toFixed(2)} g`)} (raw)`,
    SENSOR_BLOCK_END,
  ];

  return lines.join('\n');
}
