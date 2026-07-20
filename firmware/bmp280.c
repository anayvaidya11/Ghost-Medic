/*
 * bmp280.c — Bosch BMP280 pressure/temperature driver.
 *
 * The compensation routines below are direct C transcriptions of the fixed-
 * point / floating-point reference formulas published in the BMP280 datasheet
 * (section 3.11.3, "Compensation formula"). The variable names (t_fine, var1,
 * var2, dig_*) are kept identical to Bosch's reference so a reviewer can diff
 * them against the datasheet line by line. We use the floating-point variant
 * for readability; Bosch also publishes a fixed-point variant.
 *
 * UNTESTED ON HARDWARE — see README.md.
 */

#include "bmp280.h"
#include "bmp280_compensation.h"   /* pure math: compensate_*, pressure_to_altitude */
#include "i2c_helpers.h"

/* ---- Register map (BMP280 datasheet, "Memory map" table) ---------------- */
#define REG_ID          0xD0  /* Chip ID register                            */
#define REG_RESET       0xE0  /* Soft reset                                  */
#define REG_CALIB_START 0x88  /* First byte of the 24-byte calibration block */
#define REG_CTRL_MEAS   0xF4  /* osrs_t, osrs_p, power mode                   */
#define REG_CONFIG      0xF5  /* standby time, IIR filter                     */
#define REG_PRESS_MSB   0xF7  /* First of 6 burst data bytes (press+temp)    */

/* The BMP280 reports this fixed chip id in REG_ID (0x58). Sanity check. */
#define BMP280_CHIP_ID 0x58

/*
 * CTRL_MEAS (0xF4) bit layout:
 *   [7:5] osrs_t — temperature oversampling. 0b001 = x1.
 *   [4:2] osrs_p — pressure oversampling.    0b011 = x4 (good pressure noise).
 *   [1:0] mode   — 0b11 = normal (continuous) mode.
 * (0b001<<5) | (0b011<<2) | 0b11 = 0x2F.
 */
#define CTRL_MEAS_NORMAL_T1_P4 0x2F

/*
 * CONFIG (0xF5):
 *   [7:5] t_sb   — standby between samples in normal mode. 0b000 = 0.5 ms.
 *   [4:2] filter — IIR filter coefficient. 0b100 = coeff 16 (smooths noise).
 *   [0]   spi3w_en — 0 (we're on I2C, not 3-wire SPI).
 * (0b000<<5) | (0b100<<2) | 0 = 0x10.
 */
#define CONFIG_TSB05_FILTER16 0x10

/* Read a little-endian unsigned 16-bit value from two consecutive cal bytes. */
static uint16_t le16u(const uint8_t *p) {
    return (uint16_t)(p[0] | (p[1] << 8));
}
static int16_t le16s(const uint8_t *p) {
    return (int16_t)(p[0] | (p[1] << 8));
}

bool bmp280_init(i2c_inst_t *i2c, bmp280_calib_t *calib_out) {
    uint8_t id = 0;
    if (i2c_read_reg(i2c, BMP280_ADDR, REG_ID, &id) < 0) return false;
    if (id != BMP280_CHIP_ID) return false;

    /* Read the 24-byte factory calibration block (0x88..0x9F) in one burst. */
    uint8_t c[24];
    if (i2c_read_regs(i2c, BMP280_ADDR, REG_CALIB_START, c, 24) < 0)
        return false;

    /* Unpack per the datasheet's field order and signedness. */
    calib_out->dig_T1 = le16u(&c[0]);
    calib_out->dig_T2 = le16s(&c[2]);
    calib_out->dig_T3 = le16s(&c[4]);
    calib_out->dig_P1 = le16u(&c[6]);
    calib_out->dig_P2 = le16s(&c[8]);
    calib_out->dig_P3 = le16s(&c[10]);
    calib_out->dig_P4 = le16s(&c[12]);
    calib_out->dig_P5 = le16s(&c[14]);
    calib_out->dig_P6 = le16s(&c[16]);
    calib_out->dig_P7 = le16s(&c[18]);
    calib_out->dig_P8 = le16s(&c[20]);
    calib_out->dig_P9 = le16s(&c[22]);

    /* Configure filter first, then measurement mode (datasheet ordering). */
    if (i2c_write_reg(i2c, BMP280_ADDR, REG_CONFIG, CONFIG_TSB05_FILTER16) < 0)
        return false;
    if (i2c_write_reg(i2c, BMP280_ADDR, REG_CTRL_MEAS, CTRL_MEAS_NORMAL_T1_P4) < 0)
        return false;

    return true;
}

/*
 * NOTE: the Bosch floating-point compensation math (temperature + pressure)
 * and the barometric altitude formula used to live here as static functions.
 * They now live in bmp280_compensation.c as pure, hardware-free functions so
 * they can be unit-tested on a host machine. This driver reads the raw bytes
 * and calls those functions; the arithmetic is unchanged.
 */

bool bmp280_read(i2c_inst_t *i2c, const bmp280_calib_t *calib,
                 bmp280_reading_t *out) {
    out->valid = false;

    /*
     * Burst-read 6 bytes starting at PRESS_MSB (0xF7):
     *   press[19:12], press[11:4], press[3:0]<<4,
     *   temp[19:12],  temp[11:4],  temp[3:0]<<4.
     * Each of pressure and temperature is a 20-bit value.
     */
    uint8_t d[6];
    if (i2c_read_regs(i2c, BMP280_ADDR, REG_PRESS_MSB, d, 6) < 0)
        return false;

    int32_t adc_P = ((int32_t)d[0] << 12) | ((int32_t)d[1] << 4) | (d[2] >> 4);
    int32_t adc_T = ((int32_t)d[3] << 12) | ((int32_t)d[4] << 4) | (d[5] >> 4);

    float t_fine;
    out->temperature_c = bmp280_compensate_temperature(calib, adc_T, &t_fine);
    out->pressure_pa   = bmp280_compensate_pressure(calib, adc_P, t_fine);
    out->altitude_m    = bmp280_pressure_to_altitude(out->pressure_pa);

    out->valid = true;
    return true;
}
