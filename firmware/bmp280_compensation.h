/*
 * bmp280_compensation.h — PURE math for the BMP280, with NO hardware
 * dependency.
 *
 * This header intentionally does NOT include "hardware/i2c.h" or any Pico SDK
 * header. Everything here compiles on a normal computer with plain gcc, which
 * is what lets the host-side unit tests in firmware/tests/ exercise the sensor
 * math without a Pico attached.
 *
 * The functions are direct extractions of the compensation formulas that used
 * to live inline inside bmp280.c. The driver (bmp280.c) still does all the I2C
 * reads and byte-unpacking; it then hands the raw ADC integers to these pure
 * functions. Both the real driver and the tests call the SAME code here, so a
 * passing test is evidence about the code that actually ships.
 */

#ifndef GHOST_MEDIC_BMP280_COMPENSATION_H
#define GHOST_MEDIC_BMP280_COMPENSATION_H

#include <stdint.h>

/*
 * Factory calibration constants (BMP280 datasheet, "Trimming parameter
 * readout" table). Signedness matters and is specified per-field by Bosch:
 * dig_T1 and dig_P1 are unsigned; the rest are signed.
 *
 * NOTE: this struct definition lives here (not in bmp280.h) so the pure math
 * and the host tests can use it without pulling in any hardware headers.
 * bmp280.h includes this file, so the driver still sees the same type.
 */
typedef struct {
    uint16_t dig_T1;
    int16_t  dig_T2, dig_T3;
    uint16_t dig_P1;
    int16_t  dig_P2, dig_P3, dig_P4, dig_P5, dig_P6, dig_P7, dig_P8, dig_P9;
} bmp280_calib_t;

/* Sea-level reference pressure in Pa, used for the altitude estimate. */
#define BMP280_SEA_LEVEL_PA 101325.0f

/*
 * Bosch floating-point temperature compensation (datasheet 3.11.3).
 * Returns degrees Celsius. Also writes `t_fine` (a shared intermediate the
 * pressure compensation needs) to *t_fine_out. Must be called before
 * bmp280_compensate_pressure().
 */
float bmp280_compensate_temperature(const bmp280_calib_t *cal,
                                    int32_t adc_T, float *t_fine_out);

/*
 * Bosch floating-point pressure compensation (datasheet 3.11.3).
 * Returns pascals. `t_fine` comes from bmp280_compensate_temperature().
 */
float bmp280_compensate_pressure(const bmp280_calib_t *cal,
                                 int32_t adc_P, float t_fine);

/*
 * International barometric altitude formula. Assumes a standard atmosphere and
 * a fixed sea-level reference of 101325 Pa; real altitude needs the local
 * sea-level pressure (which changes with weather). Good for relative altitude
 * / a demo, not survey-grade. Returns metres.
 */
float bmp280_pressure_to_altitude(float pressure_pa);

#endif /* GHOST_MEDIC_BMP280_COMPENSATION_H */
