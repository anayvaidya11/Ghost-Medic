/*
 * fall_detection.c — PURE fall-detection state machine, no hardware dependency.
 *
 * This is the exact logic that used to live inside
 * lis3dh_update_fall_detection() in lis3dh.c, moved out verbatim so it can be
 * unit-tested on a host machine (see firmware/tests/). Only the location and
 * the input form changed: instead of a lis3dh_reading_t it now takes the bare
 * magnitude (a float in g). The state transitions and thresholds are identical,
 * so the compiled firmware behaves exactly as before.
 *
 * THIS IS ILLUSTRATIVE, NOT MEDICAL-GRADE. A production fall detector uses
 * windowed signal features and is validated against labelled fall/non-fall
 * datasets. This implements the simple, widely-taught two-phase pattern:
 *
 *   Phase 1 (free-fall): total acceleration magnitude drops near 0 g. When a
 *     body/limb is in free fall, the accelerometer briefly reads ~0 g on all
 *     axes because it is no longer being "pushed" by a support surface.
 *   Phase 2 (impact): within a short window after free-fall, a high-g spike
 *     occurs as the fall is arrested (hitting the ground).
 */

#include "fall_detection.h"

bool fall_update(fall_state_t *state, float magnitude_g, uint32_t now_ms) {
    float m = magnitude_g;

    /* Detect entry into a free-fall event. */
    if (m < FREEFALL_THRESHOLD_G) {
        state->in_freefall_window = true;
        state->freefall_start_ms  = now_ms;
        return false;   /* free-fall alone is not yet a fall */
    }

    /* If we're within the watch window after a free-fall, look for impact. */
    if (state->in_freefall_window) {
        if (now_ms - state->freefall_start_ms > FALL_IMPACT_WINDOW_MS) {
            /* Window expired with no impact — likely a controlled motion. */
            state->in_freefall_window = false;
        } else if (m > IMPACT_THRESHOLD_G) {
            /* Free-fall then impact within the window => flag a fall. */
            state->in_freefall_window = false;
            state->fall_detected = true;
            return true;
        }
    }

    return false;
}
