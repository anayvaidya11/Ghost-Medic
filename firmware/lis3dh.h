/*
 * lis3dh.h — driver for the ST LIS3DH 3-axis accelerometer.
 *
 * Datasheet: STMicroelectronics LIS3DH, DocID 17530 Rev 2 (and later revs).
 * Used in Ghost Medic for motion / fall detection.
 *
 * Bus: I2C. Address 0x18 when the SDO/SA0 pin is tied to GND (0x19 if tied
 * to VDD). Our schematic ties SDO to GND -> 0x18.
 *
 * UNTESTED ON HARDWARE — written from datasheet. See README.
 */

#ifndef GHOST_MEDIC_LIS3DH_H
#define GHOST_MEDIC_LIS3DH_H

#include "hardware/i2c.h"
#include <stdbool.h>
#include <stdint.h>

/*
 * The pure fall-detection state machine now lives in fall_detection.h, which
 * has no hardware dependency so it can be unit-tested on a host. We include it
 * here and keep lis3dh_fall_state_t as an alias of the pure fall_state_t, so
 * existing callers (main.c) compile and behave exactly as before.
 */
#include "fall_detection.h"

/* 7-bit I2C address with SDO/SA0 -> GND. */
#define LIS3DH_ADDR 0x18

/*
 * Cleaned-up reading from the sensor.
 * Acceleration is reported in units of g (1 g == gravity at Earth's surface).
 * `valid` is false if the I2C read failed.
 */
typedef struct {
    float x_g;
    float y_g;
    float z_g;
    float magnitude_g;  /* sqrt(x^2 + y^2 + z^2); ~1.0 at rest, ~0 in free-fall */
    bool  valid;
} lis3dh_reading_t;

/*
 * State kept for the fall-detection heuristic between calls. The caller owns
 * one of these and passes it into lis3dh_update_fall_detection().
 *
 * This is now just an alias for the pure fall_state_t (same struct, same
 * layout) defined in fall_detection.h. Kept as a named type so existing
 * callers using lis3dh_fall_state_t are unaffected.
 */
typedef fall_state_t lis3dh_fall_state_t;

/*
 * Initialise the LIS3DH:
 *   - verify WHO_AM_I,
 *   - enable X/Y/Z axes,
 *   - set output data rate (100 Hz) and normal power mode,
 *   - set full-scale range (+/-4 g, enough headroom for impact spikes).
 * Returns true on success (device present and configured).
 */
bool lis3dh_init(i2c_inst_t *i2c);

/* Read the three axes and fill `out`. Returns true on success. */
bool lis3dh_read(i2c_inst_t *i2c, lis3dh_reading_t *out);

/*
 * Feed one fresh reading into the fall-detection state machine.
 * `now_ms` is a millisecond timestamp (e.g. from to_ms_since_boot()).
 *
 * HEURISTIC ONLY — this is an illustrative free-fall-then-impact detector,
 * NOT a validated medical fall-detection algorithm. See comments in lis3dh.c.
 * Returns true if a fall was detected on THIS update.
 */
bool lis3dh_update_fall_detection(lis3dh_fall_state_t *state,
                                  const lis3dh_reading_t *reading,
                                  uint32_t now_ms);

#endif /* GHOST_MEDIC_LIS3DH_H */
