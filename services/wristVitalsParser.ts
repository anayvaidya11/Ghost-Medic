/**
 * WRIST VITALS PARSER — pure, no React, no I/O (so it is unit-testable headless).
 *
 * Maps one NDJSON telemetry line from the wrist unit (see ../DATA_FORMAT.md) to
 * a typed WristVitals snapshot. This mirrors what the firmware ACTUALLY emits —
 * NOT a heart-rate/BP/SpO2 shape.
 *
 * HONEST NOTE ON WHAT'S AVAILABLE:
 *   The MAX30102 provides RAW red/ir optical FIFO counts, NOT heart rate or
 *   SpO2. Computing HR/SpO2 needs a PPG algorithm the firmware does not run
 *   (see firmware/README.md). So this parser exposes `red`/`ir` as raw counts
 *   and does not invent vitals that the sensor stream does not contain.
 *
 * PARSER GOTCHA (per DATA_FORMAT.md): when a sensor's `ok` is false, its numeric
 * fields are OMITTED (not null, not 0). We reflect that as `null` here and set
 * the per-sensor `*Ok` flag to false — never as a fake 0 reading.
 */

export type WristSource = 'live' | 'connecting' | 'disconnected';

export interface WristVitals {
  // ── connection meta (set by the hook, not the parser) ──
  connected: boolean;
  source: WristSource;

  // ── timestamp ──
  tMs: number | null;

  // ── BMP280: environment ──
  bmpOk: boolean;
  tempC: number | null;
  pressPa: number | null;
  altM: number | null;

  // ── LIS3DH: motion ──
  lisOk: boolean;
  accelX: number | null;
  accelY: number | null;
  accelZ: number | null;
  accelMagG: number | null;
  fallDetected: boolean;

  // ── MAX30102: RAW optical counts (NOT heart rate / SpO2) ──
  maxOk: boolean;
  red: number | null;
  ir: number | null;
}

/** The value the app shows when nothing is connected — all readings absent. */
export const DISCONNECTED_VITALS: WristVitals = {
  connected: false,
  source: 'disconnected',
  tMs: null,
  bmpOk: false,
  tempC: null,
  pressPa: null,
  altM: null,
  lisOk: false,
  accelX: null,
  accelY: null,
  accelZ: null,
  accelMagG: null,
  fallDetected: false,
  maxOk: false,
  red: null,
  ir: null,
};

// Read a numeric field only if the sensor block reported ok:true AND the field
// is actually present (it is omitted when ok:false). Otherwise null.
function num(block: Record<string, unknown> | undefined, key: string): number | null {
  if (!block || block.ok !== true) return null;
  const v = block[key];
  return typeof v === 'number' ? v : null;
}

/**
 * Parse one NDJSON line into telemetry fields. Returns null for a line that is
 * not valid JSON, or that lacks `t_ms` (e.g. the firmware boot line). Connection
 * meta (`connected`/`source`) is left at disconnected defaults for the hook to
 * overwrite — the parser only knows about data, not the socket.
 */
export function parseWristLine(raw: string): WristVitals | null {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (obj === null || typeof obj !== 'object') return null;
  if (typeof obj.t_ms !== 'number') return null; // no t_ms => not a data line

  const max = obj.max30102 as Record<string, unknown> | undefined;
  const bmp = obj.bmp280 as Record<string, unknown> | undefined;
  const lis = obj.lis3dh as Record<string, unknown> | undefined;

  return {
    // meta placeholders — the hook sets these to live values
    connected: false,
    source: 'disconnected',

    tMs: obj.t_ms,

    bmpOk: bmp?.ok === true,
    tempC: num(bmp, 'temp_c'),
    pressPa: num(bmp, 'press_pa'),
    altM: num(bmp, 'alt_m'),

    lisOk: lis?.ok === true,
    accelX: num(lis, 'x_g'),
    accelY: num(lis, 'y_g'),
    accelZ: num(lis, 'z_g'),
    accelMagG: num(lis, 'mag_g'),
    fallDetected: obj.fall_detected === true,

    maxOk: max?.ok === true,
    red: num(max, 'red'),
    ir: num(max, 'ir'),
  };
}
