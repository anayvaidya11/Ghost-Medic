/*
 * bmp280.h — driver for the Bosch BMP280 barometric pressure + temperature
 * sensor.
 *
 * Datasheet: Bosch BMP280 Digital Pressure Sensor, BST-BMP280-DS001.
 * Used in Ghost Medic to estimate altitude from barometric pressure.
 *
 * Bus: I2C. Address 0x76 when SDO is tied to GND (0x77 if tied to VDD).
 * Our schematic ties SDO to GND -> 0x76.
 *
 * The BMP280 ships with per-chip factory calibration constants burned into
 * its NVM. Raw ADC readings are meaningless until compensated with these
 * constants using Bosch's fixed formulas (see bmp280.c). We read the
 * calibration block once at init and cache it.
 *
 * UNTESTED ON HARDWARE — written from datasheet. See README.
 */

#ifndef GHOST_MEDIC_BMP280_H
#define GHOST_MEDIC_BMP280_H

#include "hardware/i2c.h"
#include <stdbool.h>
#include <stdint.h>

/*
 * The bmp280_calib_t struct and the pure compensation math now live in
 * bmp280_compensation.h, which has NO hardware dependency so it can be unit-
 * tested on a host machine. We include it here so the driver still sees the
 * same bmp280_calib_t type it always did.
 */
#include "bmp280_compensation.h"

/* 7-bit I2C address with SDO -> GND. */
#define BMP280_ADDR 0x76

typedef struct {
    float temperature_c;    /* degrees Celsius                              */
    float pressure_pa;      /* pressure in pascals                          */
    float altitude_m;       /* estimated altitude in metres (see note)      */
    bool  valid;
} bmp280_reading_t;

/*
 * Initialise the BMP280:
 *   - verify chip id,
 *   - read + cache factory calibration,
 *   - configure oversampling and normal (continuous) measurement mode.
 * Returns true on success. `calib_out` is filled with the cached constants
 * (the caller stores it and passes it back into bmp280_read()).
 */
bool bmp280_init(i2c_inst_t *i2c, bmp280_calib_t *calib_out);

/*
 * Read a compensated temperature + pressure sample and estimate altitude.
 * `calib` must be the struct filled by bmp280_init().
 * Returns true on success.
 */
bool bmp280_read(i2c_inst_t *i2c, const bmp280_calib_t *calib,
                 bmp280_reading_t *out);

#endif /* GHOST_MEDIC_BMP280_H */
