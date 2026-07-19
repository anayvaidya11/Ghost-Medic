/*
 * max30102.c — Maxim MAX30102 optical pulse-oximeter driver (raw FIFO read).
 *
 * Register addresses and configuration field meanings are from the MAX30102
 * datasheet register map. Magic numbers are annotated with the field they set.
 *
 * UNTESTED ON HARDWARE — see README.md.
 */

#include "max30102.h"
#include "i2c_helpers.h"

/* ---- Register map (MAX30102 datasheet, "Register Maps") ----------------- */
#define REG_INT_STATUS_1  0x00  /* Interrupt status 1                        */
#define REG_FIFO_WR_PTR   0x04  /* FIFO write pointer                        */
#define REG_FIFO_OVF_CNT  0x05  /* FIFO overflow counter                     */
#define REG_FIFO_RD_PTR   0x06  /* FIFO read pointer                         */
#define REG_FIFO_DATA     0x07  /* FIFO data register (auto-advancing)       */
#define REG_FIFO_CONFIG   0x08  /* Sample averaging, rollover, almost-full   */
#define REG_MODE_CONFIG   0x09  /* Shutdown, reset, mode (HR / SpO2)         */
#define REG_SPO2_CONFIG   0x0A  /* ADC range, sample rate, LED pulse width   */
#define REG_LED1_PA       0x0C  /* LED1 (RED) pulse amplitude / drive current*/
#define REG_LED2_PA       0x0D  /* LED2 (IR)  pulse amplitude / drive current*/

/*
 * MODE_CONFIG (0x09):
 *   [6]   RESET — write 1 to soft-reset all registers to power-on defaults.
 *   [2:0] MODE  — 0b011 = SpO2 mode (RED + IR channels both active).
 */
#define MODE_RESET   0x40
#define MODE_SPO2    0x03

/*
 * FIFO_CONFIG (0x08):
 *   [7:5] SMP_AVE      — sample averaging. 0b010 = average 4 samples.
 *   [4]   FIFO_ROLLOVER_EN — 1 = FIFO wraps when full (don't stall).
 *   [3:0] FIFO_A_FULL  — almost-full threshold (unused here); leave 0.
 * (0b010<<5) | (1<<4) = 0x50.
 */
#define FIFO_CONFIG_AVG4_ROLLOVER 0x50

/*
 * SPO2_CONFIG (0x0A):
 *   [6:5] SPO2_ADC_RGE — ADC full-scale range. 0b01 = 4096 nA.
 *   [4:2] SPO2_SR      — sample rate. 0b001 = 100 samples/s.
 *   [1:0] LED_PW       — LED pulse width / ADC resolution. 0b11 = 411 us (18-bit).
 * (0b01<<5) | (0b001<<2) | 0b11 = 0x27.
 */
#define SPO2_CONFIG_4096NA_100SPS_18BIT 0x27

/*
 * LED pulse amplitude. 0x24 ~= 7.0 mA per the datasheet's ~0.2 mA/LSB scale.
 * A mid-range starting current: bright enough to get signal, not so high it
 * saturates or wastes power. Real use would tune this per skin/contact.
 */
#define LED_PA_DEFAULT 0x24

bool max30102_init(i2c_inst_t *i2c) {
    /* Soft reset, then wait for the RESET bit to self-clear. */
    if (i2c_write_reg(i2c, MAX30102_ADDR, REG_MODE_CONFIG, MODE_RESET) < 0)
        return false;

    for (int tries = 0; tries < 50; tries++) {
        uint8_t m;
        if (i2c_read_reg(i2c, MAX30102_ADDR, REG_MODE_CONFIG, &m) < 0)
            return false;
        if ((m & MODE_RESET) == 0) break;   /* reset complete */
        sleep_ms(2);
    }

    /* Clear FIFO pointers so we start from a known-empty state. */
    if (i2c_write_reg(i2c, MAX30102_ADDR, REG_FIFO_WR_PTR, 0x00) < 0) return false;
    if (i2c_write_reg(i2c, MAX30102_ADDR, REG_FIFO_OVF_CNT, 0x00) < 0) return false;
    if (i2c_write_reg(i2c, MAX30102_ADDR, REG_FIFO_RD_PTR, 0x00) < 0) return false;

    if (i2c_write_reg(i2c, MAX30102_ADDR, REG_FIFO_CONFIG,
                      FIFO_CONFIG_AVG4_ROLLOVER) < 0) return false;
    if (i2c_write_reg(i2c, MAX30102_ADDR, REG_SPO2_CONFIG,
                      SPO2_CONFIG_4096NA_100SPS_18BIT) < 0) return false;
    if (i2c_write_reg(i2c, MAX30102_ADDR, REG_LED1_PA, LED_PA_DEFAULT) < 0)
        return false;
    if (i2c_write_reg(i2c, MAX30102_ADDR, REG_LED2_PA, LED_PA_DEFAULT) < 0)
        return false;

    /* Enter SpO2 mode LAST, once everything else is configured. */
    if (i2c_write_reg(i2c, MAX30102_ADDR, REG_MODE_CONFIG, MODE_SPO2) < 0)
        return false;

    return true;
}

bool max30102_read(i2c_inst_t *i2c, max30102_sample_t *out) {
    out->valid = false;

    /*
     * Determine how many samples are waiting: num = (wr_ptr - rd_ptr) mod 32.
     * The FIFO holds 32 slots; the pointers are 5-bit and wrap.
     */
    uint8_t wr = 0, rd = 0;
    if (i2c_read_reg(i2c, MAX30102_ADDR, REG_FIFO_WR_PTR, &wr) < 0) return false;
    if (i2c_read_reg(i2c, MAX30102_ADDR, REG_FIFO_RD_PTR, &rd) < 0) return false;

    int num_available = ((int)wr - (int)rd) & 0x1F;   /* mod 32 */
    if (num_available <= 0)
        return false;   /* nothing new yet */

    /*
     * In SpO2 mode each FIFO sample is 6 bytes: 3 for RED, 3 for IR.
     * Each channel is 18 bits, MSB-first, left-justified in 3 bytes; the top
     * 6 bits are unused and must be masked off (& 0x03 on the high byte).
     * Reading FIFO_DATA repeatedly auto-advances the FIFO read pointer.
     */
    uint8_t s[6];
    if (i2c_read_regs(i2c, MAX30102_ADDR, REG_FIFO_DATA, s, 6) < 0)
        return false;

    out->red = (((uint32_t)(s[0] & 0x03)) << 16)
             | (((uint32_t)s[1]) << 8)
             |  ((uint32_t)s[2]);
    out->ir  = (((uint32_t)(s[3] & 0x03)) << 16)
             | (((uint32_t)s[4]) << 8)
             |  ((uint32_t)s[5]);

    out->valid = true;
    return true;
}
