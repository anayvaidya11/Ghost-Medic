/**
 * FALL TRIGGER — pure, no React, no I/O (headless-testable).
 *
 * Decides when a fall_detected reading should auto-submit an LLM query
 * (Phase 2 demo moment). Guards, per the roadmap:
 *   - RISING EDGE only: fires on a false→true transition, never on every
 *     "true" line — a looping replay source repeats the same fall line
 *     forever and must not spam the model.
 *   - COOLDOWN: after firing, further fall events are ignored for
 *     `cooldownMs` (wall-clock — the replay's t_ms resets every loop and
 *     cannot be trusted for this).
 *   - SUPPRESSED consumption: while `suppressed` (request in flight, user
 *     mid-photo-review, or auto-trigger toggled off) a rising edge is
 *     CONSUMED without firing — it does not queue up and fire later on a
 *     stale "still true" reading.
 */

/** Default cooldown between auto-triggered queries (ms, wall-clock). */
export const FALL_TRIGGER_COOLDOWN_MS = 30_000;

export interface FallTrigger {
  /**
   * Feed one observation. Returns true exactly when an auto-query should
   * fire now. `nowMs` must be wall-clock (Date.now()), not stream t_ms.
   */
  update(fallDetected: boolean, nowMs: number, suppressed: boolean): boolean;
}

export function createFallTrigger(
  opts: { cooldownMs: number } = { cooldownMs: FALL_TRIGGER_COOLDOWN_MS }
): FallTrigger {
  let prevFall = false;
  let lastFiredMs = Number.NEGATIVE_INFINITY;

  return {
    update(fallDetected: boolean, nowMs: number, suppressed: boolean): boolean {
      const risingEdge = fallDetected && !prevFall;
      prevFall = fallDetected;

      if (!risingEdge) return false;
      if (suppressed) return false; // consumed, not queued
      if (nowMs - lastFiredMs < opts.cooldownMs) return false;

      lastFiredMs = nowMs;
      return true;
    },
  };
}
