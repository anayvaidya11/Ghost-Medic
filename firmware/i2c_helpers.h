/*
 * i2c_helpers.h — thin wrappers around the Pico SDK hardware/i2c.h API.
 *
 * All three sensor drivers (MAX30102, BMP280, LIS3DH) talk to the same I2C
 * bus and use the same fundamental operations: write one byte to a register,
 * read one or more bytes starting at a register. Rather than repeat the
 * Pico SDK boilerplate in every driver, we centralise it here.
 *
 * I2C register access pattern (true for all three sensors):
 *   - To WRITE a register: send [reg_addr, value] in a single transaction.
 *   - To READ a register:   send [reg_addr] (no stop), then read N bytes.
 *     The "no stop" (repeated start) is what tells the device "I'm about to
 *     read from the address pointer I just set" rather than starting fresh.
 *
 * These helpers return the underlying Pico SDK return code so callers can
 * detect a NAK / missing device (PICO_ERROR_GENERIC == -1) if they wish.
 *
 * NOTE: This code has been written against the device datasheets and the
 * Pico SDK docs. It has NOT been run on physical hardware. See README.
 */

#ifndef GHOST_MEDIC_I2C_HELPERS_H
#define GHOST_MEDIC_I2C_HELPERS_H

#include "hardware/i2c.h"
#include "pico/stdlib.h"

/*
 * Write a single byte `value` to register `reg` on the device at `addr`.
 * Returns number of bytes written on success, or a negative PICO_ERROR_* code.
 */
static inline int i2c_write_reg(i2c_inst_t *i2c, uint8_t addr,
                                uint8_t reg, uint8_t value) {
    uint8_t buf[2] = { reg, value };
    // `false` for the nostop arg => issue a STOP after the write (transaction done).
    return i2c_write_blocking(i2c, addr, buf, 2, false);
}

/*
 * Read `len` bytes starting at register `reg` from the device at `addr`
 * into `dst`. Uses a repeated-start: write the register pointer with
 * nostop=true, then read.
 * Returns number of bytes read on success, or a negative PICO_ERROR_* code.
 */
static inline int i2c_read_regs(i2c_inst_t *i2c, uint8_t addr,
                                uint8_t reg, uint8_t *dst, size_t len) {
    // Write the register address we want to read from. nostop=true keeps
    // the bus so the following read is a repeated-start, not a fresh one.
    int rc = i2c_write_blocking(i2c, addr, &reg, 1, true);
    if (rc < 0) return rc;
    return i2c_read_blocking(i2c, addr, dst, len, false);
}

/* Convenience: read exactly one register. */
static inline int i2c_read_reg(i2c_inst_t *i2c, uint8_t addr,
                               uint8_t reg, uint8_t *dst) {
    return i2c_read_regs(i2c, addr, reg, dst, 1);
}

#endif /* GHOST_MEDIC_I2C_HELPERS_H */
