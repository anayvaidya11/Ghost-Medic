/*
 * max30102.h — driver for the Maxim MAX30102 pulse oximeter / heart-rate
 * optical sensor.
 *
 * Datasheet: Maxim Integrated MAX30102, 19-7740 Rev 1.
 * Used in Ghost Medic to capture raw RED/IR photoplethysmography samples.
 *
 * Bus: I2C. Fixed address 0x57 (the MAX30102 has no address-select pin).
 *
 * SCOPE NOTE: this driver reads the RAW RED and IR light values out of the
 * sensor FIFO. It deliberately does NOT compute heart rate or SpO2 — those
 * require signal processing (peak detection, ratio-of-ratios, calibration
 * curves) that is out of scope for this milestone. Raw counts are enough to
 * prove the sensor and data path work.
 *
 * UNTESTED ON HARDWARE — written from datasheet. See README.
 */

#ifndef GHOST_MEDIC_MAX30102_H
#define GHOST_MEDIC_MAX30102_H

#include "hardware/i2c.h"
#include <stdbool.h>
#include <stdint.h>

/* Fixed 7-bit I2C address (no external select pin on the MAX30102). */
#define MAX30102_ADDR 0x57

/*
 * One FIFO sample. In SpO2 mode each sample slot holds two 18-bit channels:
 * RED then IR. We store them zero-extended into uint32_t.
 */
typedef struct {
    uint32_t red;   /* raw RED channel counts (18-bit)  */
    uint32_t ir;    /* raw IR  channel counts (18-bit)  */
    bool     valid;
} max30102_sample_t;

/*
 * Initialise the MAX30102:
 *   - soft reset,
 *   - configure FIFO (sample averaging, rollover),
 *   - set SpO2 mode (RED + IR), ADC range, sample rate, pulse width,
 *   - set LED pulse amplitudes (drive current) for both LEDs.
 * Returns true on success.
 */
bool max30102_init(i2c_inst_t *i2c);

/*
 * Read the most recent available sample from the FIFO.
 *
 * For this milestone we keep it simple: read the write/read pointers, and if
 * at least one new sample is available, read one 6-byte sample (RED+IR) and
 * return it. A fuller implementation would drain all pending samples; one is
 * enough for a periodic demo loop.
 * Returns true if a fresh sample was produced.
 */
bool max30102_read(i2c_inst_t *i2c, max30102_sample_t *out);

#endif /* GHOST_MEDIC_MAX30102_H */
