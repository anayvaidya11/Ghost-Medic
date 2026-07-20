/*
 * test_fall.c — host-side unit tests for the pure fall-detection state machine.
 *
 * Runs on a normal computer with plain gcc. No Pico, no accelerometer.
 * It drives the SAME fall_update() the firmware uses (fall_detection.c) with
 * scripted magnitude sequences and checks that it flags real falls and ignores
 * non-falls.
 *
 * What this proves: the free-fall -> impact -> window LOGIC is correct.
 * What it does NOT prove: that a real LIS3DH produces these magnitudes during
 * an actual fall, or that the thresholds are well-tuned for a real wrist. That
 * needs data from real hardware.
 *
 * Build & run: see the Makefile in this folder (`make`), or:
 *   gcc -Wall -Wextra -std=c11 -I.. ../fall_detection.c test_fall.c -lm -o test_fall
 *   ./test_fall
 *
 * Recall the thresholds (from fall_detection.h):
 *   free-fall  : magnitude < 0.35 g
 *   impact     : magnitude > 2.5 g
 *   window     : impact must arrive within 400 ms of the free-fall
 * The firmware ticks at 10 Hz, so we step timestamps in 100 ms increments.
 */

#include "fall_detection.h"
#include <stdio.h>

static int checks_run = 0;
static int checks_failed = 0;

static void check_true(const char *name, int cond) {
    checks_run++;
    if (cond) {
        printf("  PASS  %s\n", name);
    } else {
        checks_failed++;
        printf("  FAIL  %s (condition was false)\n", name);
    }
}

/*
 * Feed a sequence of (magnitude, timestamp) samples into a fresh state machine
 * and report whether a fall was flagged on ANY sample. `n` is the sample count.
 */
static int run_sequence(const float *mags, const uint32_t *ts, int n) {
    fall_state_t state = {0};          /* start at rest, nothing armed */
    int flagged = 0;
    for (int i = 0; i < n; i++) {
        if (fall_update(&state, mags[i], ts[i]))
            flagged = 1;
    }
    return flagged;
}

int main(void) {
    printf("== Fall-detection state machine (host tests) ==\n\n");

    /* ---- Scenario A: a real fall SHOULD be flagged --------------------- *
     * resting ~1 g, then free-fall (<0.35 g) for a few ticks, then an
     * impact spike (>2.5 g) 100 ms after the last free-fall sample — well
     * inside the 400 ms window.                                            */
    {
        const float    mags[] = { 1.00f, 1.00f, 0.10f, 0.08f, 0.12f, 3.10f, 1.00f };
        const uint32_t ts[]   = {    0,   100,   200,   300,   400,   500,   600 };
        int flagged = run_sequence(mags, ts, 7);
        check_true("A: free-fall then impact within window => FALL flagged",
                   flagged == 1);
    }

    /* ---- Scenario B: a bare jolt SHOULD NOT be flagged ----------------- *
     * No free-fall first — just a hard knock (>2.5 g) from a resting state.
     * A jolt without a preceding free-fall must be ignored.                */
    {
        const float    mags[] = { 1.00f, 1.00f, 3.50f, 1.00f, 1.00f };
        const uint32_t ts[]   = {    0,   100,   200,   300,   400 };
        int flagged = run_sequence(mags, ts, 5);
        check_true("B: impact with NO prior free-fall => NOT flagged",
                   flagged == 0);
    }

    /* ---- Scenario C: impact too late SHOULD NOT be flagged ------------- *
     * Free-fall occurs, but the impact arrives more than 400 ms after it —
     * outside the window — so it must NOT count as a fall.
     * Last free-fall sample is at t=200 ms; impact at t=700 ms is 500 ms
     * later (> 400 ms window).                                             */
    {
        const float    mags[] = { 1.00f, 0.10f, 1.00f, 1.00f, 1.00f, 3.10f };
        const uint32_t ts[]   = {    0,   200,   300,   400,   600,   700 };
        int flagged = run_sequence(mags, ts, 6);
        check_true("C: impact AFTER the 400 ms window => NOT flagged",
                   flagged == 0);
    }

    printf("\n== Fall: %d checks, %d failed ==\n\n", checks_run, checks_failed);
    return checks_failed == 0 ? 0 : 1;
}
