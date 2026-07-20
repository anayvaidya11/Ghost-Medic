/*
 * test_bmp280.c — host-side unit tests for the pure BMP280 compensation math.
 *
 * Runs on a normal computer with plain gcc. No Pico, no I2C, no hardware.
 * It feeds known raw inputs into the SAME pure functions the firmware uses
 * (bmp280_compensation.c) and checks the outputs against expected values.
 *
 * What this proves: the compensation FORMULAS are transcribed correctly and
 * the altitude helper behaves sensibly.
 * What it does NOT prove: that a real BMP280 is wired up, returns these raw
 * values, or is calibrated as assumed. That still needs a bench test on
 * actual hardware.
 *
 * Build & run: see the Makefile in this folder (`make`), or:
 *   gcc -Wall -Wextra -std=c11 -I.. ../bmp280_compensation.c test_bmp280.c -lm -o test_bmp280
 *   ./test_bmp280
 */

#include "bmp280_compensation.h"
#include <stdio.h>
#include <math.h>

/* ---- Tiny test harness -------------------------------------------------- */
static int checks_run = 0;
static int checks_failed = 0;

/* Pass if |actual - expected| <= tol. Prints one PASS/FAIL line per check. */
static void check_close(const char *name, double actual, double expected,
                        double tol) {
    checks_run++;
    double diff = fabs(actual - expected);
    if (diff <= tol) {
        printf("  PASS  %-42s got %.4f (want %.4f +/- %.4f)\n",
               name, actual, expected, tol);
    } else {
        checks_failed++;
        printf("  FAIL  %-42s got %.4f (want %.4f +/- %.4f)\n",
               name, actual, expected, tol);
    }
}

static void check_true(const char *name, int cond) {
    checks_run++;
    if (cond) {
        printf("  PASS  %-42s\n", name);
    } else {
        checks_failed++;
        printf("  FAIL  %-42s (condition was false)\n", name);
    }
}

int main(void) {
    printf("== BMP280 compensation math (host tests) ==\n");

    /*
     * Bosch datasheet reference calibration set and raw ADC values.
     *
     * IMPORTANT: these constants and the expected results (25.08 C, ~100653 Pa)
     * are the classic worked example that circulates for the BMP280. Before
     * calling this "datasheet-verified", double-check the dig_T and dig_P
     * constants and the expected outputs against YOUR actual BMP280 datasheet
     * PDF (Bosch BST-BMP280-DS001, section 3.11.3 / 8.1). Treat them as a
     * strong sanity check, not gospel, until you have confirmed them at source.
     *
     * We use the FLOATING-POINT variant of the compensation, so results differ
     * very slightly from the integer/fixed-point reference — hence loose
     * tolerances below.
     */
    bmp280_calib_t cal = {
        .dig_T1 = 27504, .dig_T2 = 26435, .dig_T3 = -1000,
        .dig_P1 = 36477, .dig_P2 = -10685, .dig_P3 = 3024,
        .dig_P4 = 2855,  .dig_P5 = 140,   .dig_P6 = -7,
        .dig_P7 = 15500, .dig_P8 = -14600, .dig_P9 = 6000
    };
    const int32_t adc_T = 519888;
    const int32_t adc_P = 415148;

    float t_fine = 0.0f;
    float temp_c   = bmp280_compensate_temperature(&cal, adc_T, &t_fine);
    float press_pa = bmp280_compensate_pressure(&cal, adc_P, t_fine);

    printf("\n-- compensation against Bosch reference example --\n");
    check_close("temperature ~= 25.08 C", temp_c, 25.08, 0.10);
    check_close("pressure ~= 100653 Pa",  press_pa, 100653.0, 50.0);

    printf("\n-- altitude helper sanity checks --\n");
    float alt_sea   = bmp280_pressure_to_altitude(101325.0f);
    float alt_1000  = bmp280_pressure_to_altitude(89875.0f);
    float alt_lower = bmp280_pressure_to_altitude(90000.0f);
    float alt_higher_press = bmp280_pressure_to_altitude(95000.0f);

    check_close("sea-level pressure -> ~0 m", alt_sea, 0.0, 0.5);
    check_close("~89875 Pa -> ~1000 m",       alt_1000, 1000.0, 5.0);
    /* Physical monotonicity: lower pressure must read as higher altitude. */
    check_true("lower pressure => higher altitude", alt_lower > alt_higher_press);
    check_true("all altitudes above sea level >= 0", alt_1000 > 0.0f && alt_lower > 0.0f);

    /* ---- Summary ---- */
    printf("\n== BMP280: %d checks, %d failed ==\n\n",
           checks_run, checks_failed);
    return checks_failed == 0 ? 0 : 1;
}
