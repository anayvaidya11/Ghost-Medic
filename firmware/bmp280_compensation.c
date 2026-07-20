/*
 * bmp280_compensation.c — PURE BMP280 math, no hardware dependency.
 *
 * These three functions are lifted VERBATIM from the formulas that previously
 * lived inline in bmp280.c (the two static compensate_* helpers and the
 * altitude calculation at the end of bmp280_read). Only their location
 * changed — the arithmetic is byte-for-byte the same, so the compiled
 * firmware behaves identically. Extracting them here is purely so they can be
 * compiled and tested on a normal computer (see firmware/tests/).
 *
 * The compensation routines are direct C transcriptions of the floating-point
 * reference formulas in the BMP280 datasheet (section 3.11.3). Variable names
 * (t_fine, var1, var2, dig_*) are kept identical to Bosch's reference so a
 * reviewer can diff them against the datasheet line by line.
 */

#include "bmp280_compensation.h"
#include <math.h>

/*
 * Temperature must be compensated first because it produces `t_fine`, a shared
 * intermediate that the pressure compensation also needs.
 */
float bmp280_compensate_temperature(const bmp280_calib_t *cal,
                                    int32_t adc_T, float *t_fine_out) {
    float var1 = (((float)adc_T) / 16384.0f - ((float)cal->dig_T1) / 1024.0f)
                 * ((float)cal->dig_T2);
    float var2 = ((((float)adc_T) / 131072.0f - ((float)cal->dig_T1) / 8192.0f)
                 * (((float)adc_T) / 131072.0f - ((float)cal->dig_T1) / 8192.0f))
                 * ((float)cal->dig_T3);
    float t_fine = var1 + var2;
    *t_fine_out = t_fine;
    return t_fine / 5120.0f;    /* degrees Celsius */
}

float bmp280_compensate_pressure(const bmp280_calib_t *cal,
                                 int32_t adc_P, float t_fine) {
    float var1 = (t_fine / 2.0f) - 64000.0f;
    float var2 = var1 * var1 * ((float)cal->dig_P6) / 32768.0f;
    var2 = var2 + var1 * ((float)cal->dig_P5) * 2.0f;
    var2 = (var2 / 4.0f) + (((float)cal->dig_P4) * 65536.0f);
    var1 = (((float)cal->dig_P3) * var1 * var1 / 524288.0f
           + ((float)cal->dig_P2) * var1) / 524288.0f;
    var1 = (1.0f + var1 / 32768.0f) * ((float)cal->dig_P1);

    if (var1 == 0.0f)
        return 0.0f;   /* avoid divide-by-zero (Bosch guards this case) */

    float p = 1048576.0f - (float)adc_P;
    p = (p - (var2 / 4096.0f)) * 6250.0f / var1;
    var1 = ((float)cal->dig_P9) * p * p / 2147483648.0f;
    var2 = p * ((float)cal->dig_P8) / 32768.0f;
    p = p + (var1 + var2 + ((float)cal->dig_P7)) / 16.0f;
    return p;   /* pascals */
}

float bmp280_pressure_to_altitude(float pressure_pa) {
    return 44330.0f *
        (1.0f - powf(pressure_pa / BMP280_SEA_LEVEL_PA, 0.1903f));
}
