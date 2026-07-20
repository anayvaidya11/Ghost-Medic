/*
 * fall_detection.h — PURE fall-detection state machine, no hardware
 * dependency.
 *
 * This header does NOT include any Pico SDK header, so it (and fall_detection.c)
 * compile on a normal computer. That is what lets the host tests in
 * firmware/tests/ exercise the fall logic without a Pico.
 *
 * The logic was previously inline inside lis3dh.c. It now lives here as a pure
 * function of (accelerometer magnitude, timestamp) plus a small state struct.
 * lis3dh.c still does the I2C read and computes the magnitude, then calls
 * fall_update(). The real driver and the tests run the SAME state machine.
 *
 * HEURISTIC ONLY — this is an illustrative free-fall-then-impact detector,
 * NOT a validated medical fall-detection algorithm.
 */

#ifndef GHOST_MEDIC_FALL_DETECTION_H
#define GHOST_MEDIC_FALL_DETECTION_H

#include <stdbool.h>
#include <stdint.h>

/*
 * Thresholds (reasonable textbook starting points, NOT tuned values):
 *   - free-fall: total acceleration magnitude drops below FREEFALL_THRESHOLD_G
 *   - impact:    magnitude spikes above IMPACT_THRESHOLD_G
 *   - the impact must follow the free-fall within FALL_IMPACT_WINDOW_MS
 */
#define FREEFALL_THRESHOLD_G   0.35f   /* magnitude below this => "free fall"  */
#define IMPACT_THRESHOLD_G     2.5f    /* magnitude above this => "impact"     */
#define FALL_IMPACT_WINDOW_MS  400u    /* impact must follow within this time  */

/*
 * State kept between calls. The caller owns one of these and passes it into
 * fall_update(). Zero-initialise it (e.g. `fall_state_t s = {0};`).
 */
typedef struct {
    bool     in_freefall_window;   /* currently within the post-freefall watch window */
    uint32_t freefall_start_ms;    /* when free-fall was first seen */
    bool     fall_detected;        /* latched true when a fall pattern completes */
} fall_state_t;

/*
 * Feed one fresh acceleration magnitude (in g) and its millisecond timestamp
 * into the state machine.
 *
 *   Phase 1 (free-fall): magnitude drops near 0 g. Arms the watch window.
 *   Phase 2 (impact):    within FALL_IMPACT_WINDOW_MS, magnitude spikes high.
 * A fall is flagged only if an impact spike follows a free-fall dip within the
 * window. This ordering requirement rejects ordinary jolts.
 *
 * Returns true if a fall was detected on THIS update.
 */
bool fall_update(fall_state_t *state, float magnitude_g, uint32_t now_ms);

#endif /* GHOST_MEDIC_FALL_DETECTION_H */
