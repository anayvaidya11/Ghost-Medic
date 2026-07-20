/*
 * lis3dh.c — ST LIS3DH 3-axis accelerometer driver.
 *
 * Register names/addresses and configuration bit meanings are taken from the
 * LIS3DH datasheet. Where a magic number appears it is annotated with the
 * datasheet field it corresponds to.
 *
 * UNTESTED ON HARDWARE — see README.md.
 */

#include "lis3dh.h"
#include "i2c_helpers.h"
#include <math.h>

/* ---- Register map (LIS3DH datasheet, "Register mapping" table) ---------- */
#define REG_WHO_AM_I    0x0F  /* Device identification register             */
#define REG_CTRL_REG1   0x20  /* Data rate, low-power mode, axis enables    */
#define REG_CTRL_REG4   0x23  /* Full-scale selection, high-res, endianness */
#define REG_OUT_X_L     0x28  /* X-axis low byte (first of 6 output bytes)  */

/*
 * WHO_AM_I always reads back this fixed value on a genuine LIS3DH. Reading
 * it is our cheap "is the right chip actually there?" sanity check.
 */
#define LIS3DH_WHO_AM_I_EXPECTED 0x33

/*
 * CTRL_REG1 (0x20) bit layout:
 *   [7:4] ODR3..ODR0 — output data rate. 0b0101 = 100 Hz (normal mode).
 *   [3]   LPen       — low-power enable. 0 = normal mode.
 *   [2]   Zen, [1] Yen, [0] Xen — per-axis enables. 1 = enabled.
 * 0b0101 (100Hz) << 4 | 0b0111 (Z,Y,X enabled) = 0x57.
 */
#define CTRL_REG1_100HZ_XYZ 0x57

/*
 * CTRL_REG4 (0x23) bit layout (fields we care about):
 *   [7]   BDU  — block data update. 1 = don't update a value mid-read
 *                (prevents reading a low byte from sample N and a high byte
 *                 from sample N+1). Strongly recommended.
 *   [5:4] FS1..FS0 — full-scale. 0b01 = +/-4 g.
 *   [3]   HR   — high-resolution output. 1 = enabled (12-bit).
 * BDU(1<<7) | FS=01(1<<4) | HR(1<<3) = 0x98.
 */
#define CTRL_REG4_BDU_4G_HR 0x98

/*
 * Sensitivity (LSB -> mg) depends on full-scale AND resolution mode.
 * In high-resolution (12-bit) mode at +/-4 g, the datasheet mechanical
 * characteristics table gives 2 mg/LSB.
 *
 * The raw 16-bit registers are left-justified: the 12 meaningful bits sit in
 * the top of the 16-bit word, so we shift the combined value right by 4 to
 * get the signed 12-bit sample, then multiply by the mg/LSB figure.
 */
#define LIS3DH_MG_PER_LSB_HR_4G 2.0f

bool lis3dh_init(i2c_inst_t *i2c) {
    uint8_t who = 0;
    if (i2c_read_reg(i2c, LIS3DH_ADDR, REG_WHO_AM_I, &who) < 0)
        return false;                 /* device didn't ACK — not present/miswired */
    if (who != LIS3DH_WHO_AM_I_EXPECTED)
        return false;                 /* someone else answered at this address    */

    if (i2c_write_reg(i2c, LIS3DH_ADDR, REG_CTRL_REG1, CTRL_REG1_100HZ_XYZ) < 0)
        return false;
    if (i2c_write_reg(i2c, LIS3DH_ADDR, REG_CTRL_REG4, CTRL_REG4_BDU_4G_HR) < 0)
        return false;

    return true;
}

bool lis3dh_read(i2c_inst_t *i2c, lis3dh_reading_t *out) {
    out->valid = false;

    /*
     * Burst-read 6 bytes: OUT_X_L, OUT_X_H, OUT_Y_L, OUT_Y_H, OUT_Z_L, OUT_Z_H.
     *
     * IMPORTANT: to auto-increment the register pointer across a multi-byte
     * read, the LIS3DH requires bit 7 (MSB) of the sub-address to be set.
     * So we read starting from (REG_OUT_X_L | 0x80).
     */
    uint8_t raw[6];
    if (i2c_read_regs(i2c, LIS3DH_ADDR, REG_OUT_X_L | 0x80, raw, 6) < 0)
        return false;

    /* Combine low/high into signed 16-bit, then >>4 for the 12-bit sample. */
    int16_t x = (int16_t)((raw[1] << 8) | raw[0]) >> 4;
    int16_t y = (int16_t)((raw[3] << 8) | raw[2]) >> 4;
    int16_t z = (int16_t)((raw[5] << 8) | raw[4]) >> 4;

    /* Convert to g: (LSB * mg/LSB) / 1000. */
    out->x_g = (x * LIS3DH_MG_PER_LSB_HR_4G) / 1000.0f;
    out->y_g = (y * LIS3DH_MG_PER_LSB_HR_4G) / 1000.0f;
    out->z_g = (z * LIS3DH_MG_PER_LSB_HR_4G) / 1000.0f;
    out->magnitude_g = sqrtf(out->x_g * out->x_g +
                             out->y_g * out->y_g +
                             out->z_g * out->z_g);
    out->valid = true;
    return true;
}

/* ---- Fall detection heuristic ------------------------------------------- *
 *
 * The actual state machine now lives in fall_detection.c as the pure,
 * hardware-free function fall_update() (so it can be unit-tested on a host).
 * This wrapper keeps the driver-facing API unchanged: it drops invalid
 * readings, then hands the magnitude and timestamp to fall_update(). Behaviour
 * is identical to the previous inline implementation.
 */
bool lis3dh_update_fall_detection(lis3dh_fall_state_t *state,
                                  const lis3dh_reading_t *reading,
                                  uint32_t now_ms) {
    if (!reading->valid) return false;
    return fall_update(state, reading->magnitude_g, now_ms);
}
