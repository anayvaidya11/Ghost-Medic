/*
 * trace_driver.c — generates the data behind two charts on the website.
 *
 * It links the SAME source files the firmware is built from
 * (../../firmware/fall_detection.c and ../../firmware/bmp280_compensation.c),
 * so every decision and every altitude value in the charts comes from the
 * shipping code, not a reimplementation.
 *
 * Output 1, fall_trace.csv: a synthetic 10 Hz acceleration trace (a person at
 * rest, a fall at t=2.0 s, recovery) fed sample-by-sample through fall_update().
 * The trace is invented; the detection decisions are the real state machine.
 *
 * Output 2, altitude_curve.csv: pressure swept 55..103 kPa through
 * bmp280_pressure_to_altitude().
 *
 * Build and run (see README.md in this folder):
 *   gcc -Wall -Wextra -std=c11 -I../../firmware trace_driver.c \
 *       ../../firmware/fall_detection.c ../../firmware/bmp280_compensation.c \
 *       -lm -o trace_driver && ./trace_driver
 */

#include <stdio.h>
#include "fall_detection.h"
#include "bmp280_compensation.h"

int main(void) {
    /* ---- fall trace ---- */
    /* 10 Hz, 4 seconds. Rest near 1 g, free-fall dip at 2.0 s, impact at
     * 2.3 s (within the 400 ms window), then settling. */
    static const float mag[] = {
        1.00f, 1.02f, 0.98f, 1.01f, 0.99f, 1.03f, 0.97f, 1.00f, 1.02f, 0.99f,
        1.01f, 0.98f, 1.00f, 1.04f, 0.97f, 1.01f, 0.99f, 1.02f, 0.98f, 1.00f,
        0.28f, 0.09f, 0.11f,                  /* free-fall, t = 2.0..2.2 s   */
        2.62f,                                /* impact,    t = 2.3 s        */
        1.62f, 1.21f, 0.90f, 1.06f, 0.97f, 1.01f,
        0.99f, 1.00f, 1.02f, 0.98f, 1.01f, 0.99f, 1.00f, 1.02f, 0.98f, 1.00f,
    };
    const int n = (int)(sizeof mag / sizeof mag[0]);

    FILE *f = fopen("fall_trace.csv", "w");
    if (!f) return 1;
    fprintf(f, "t_s,mag_g,fall_flagged\n");

    fall_state_t st = {0};
    for (int i = 0; i < n; i++) {
        uint32_t t_ms = (uint32_t)(i * 100);
        bool fired = fall_update(&st, mag[i], t_ms);
        fprintf(f, "%.1f,%.2f,%d\n", t_ms / 1000.0, mag[i], fired ? 1 : 0);
    }
    fclose(f);

    /* ---- altitude curve ---- */
    f = fopen("altitude_curve.csv", "w");
    if (!f) return 1;
    fprintf(f, "pressure_pa,altitude_m\n");
    for (int p = 55000; p <= 103000; p += 250)
        fprintf(f, "%d,%.2f\n", p, bmp280_pressure_to_altitude((float)p));
    fclose(f);

    printf("wrote fall_trace.csv (%d samples) and altitude_curve.csv\n", n);
    return 0;
}
