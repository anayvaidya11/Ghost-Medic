/*
 * main.c — Ghost Medic sensor-hub firmware (breadboard prototype).
 *
 * Brings up the I2C bus and all three sensors, then loops every 100 ms:
 * reads each sensor, runs the fall-detection heuristic, and prints one JSON
 * object per line over USB serial. A downstream host (a small serial->WebSocket
 * bridge feeding the React Native app) consumes these lines.
 *
 * Bus: SDA = GPIO4, SCL = GPIO5, 400 kHz (fast mode).
 *   Why 400 kHz: all three sensors support fast mode; on short breadboard
 *   wiring there's no signal-integrity reason to run slower, and the higher
 *   rate leaves headroom for reading three devices inside each 100 ms tick.
 *   If wiring is long/noisy and reads fail, drop to 100 kHz (one constant).
 *
 * Output format (one line per tick), e.g.:
 *   {"t_ms":1234,"max30102":{"ok":true,"red":10342,"ir":10501},
 *    "bmp280":{"ok":true,"temp_c":22.5,"press_pa":101010.2,"alt_m":25.7},
 *    "lis3dh":{"ok":true,"x_g":0.01,"y_g":-0.02,"z_g":0.99,"mag_g":0.99},
 *    "fall_detected":false}
 *
 * UNTESTED ON HARDWARE — see README.md.
 */

#include <stdio.h>
#include "pico/stdlib.h"
#include "hardware/i2c.h"

#include "max30102.h"
#include "bmp280.h"
#include "lis3dh.h"

/* ---- Bus configuration -------------------------------------------------- */
#define I2C_PORT     i2c0
#define I2C_SDA_PIN  4          /* GPIO4 */
#define I2C_SCL_PIN  5          /* GPIO5 */
#define I2C_BAUD     400000     /* 400 kHz fast mode */

#define LOOP_PERIOD_MS 100      /* 10 Hz packaging loop */

static void i2c_bus_init(void) {
    i2c_init(I2C_PORT, I2C_BAUD);
    gpio_set_function(I2C_SDA_PIN, GPIO_FUNC_I2C);
    gpio_set_function(I2C_SCL_PIN, GPIO_FUNC_I2C);
    /*
     * Enable the RP2040's internal pull-ups as a fallback. On the real design
     * (and most breakout modules) there are stronger external 4.7k pull-ups;
     * the internal ones (~50k) are weak but prevent a fully floating bus if a
     * module lacks them. Harmless to have both.
     */
    gpio_pull_up(I2C_SDA_PIN);
    gpio_pull_up(I2C_SCL_PIN);
}

int main(void) {
    stdio_init_all();          /* USB serial (stdio over USB CDC) */

    /*
     * Give the USB CDC link a moment to enumerate so we don't drop the first
     * lines of output when viewing on a host terminal.
     */
    sleep_ms(2000);

    i2c_bus_init();

    /* Init each sensor; record which came up so we still stream the others. */
    bool max_ok = max30102_init(I2C_PORT);
    bmp280_calib_t bmp_calib;
    bool bmp_ok = bmp280_init(I2C_PORT, &bmp_calib);
    bool lis_ok = lis3dh_init(I2C_PORT);

    printf("{\"boot\":true,\"max30102_init\":%s,\"bmp280_init\":%s,"
           "\"lis3dh_init\":%s}\n",
           max_ok ? "true" : "false",
           bmp_ok ? "true" : "false",
           lis_ok ? "true" : "false");

    lis3dh_fall_state_t fall_state = {0};

    while (true) {
        uint32_t now = to_ms_since_boot(get_absolute_time());

        max30102_sample_t max_s = { .valid = false };
        bmp280_reading_t  bmp_r = { .valid = false };
        lis3dh_reading_t  lis_r = { .valid = false };

        if (max_ok) max30102_read(I2C_PORT, &max_s);
        if (bmp_ok) bmp280_read(I2C_PORT, &bmp_calib, &bmp_r);
        if (lis_ok) lis3dh_read(I2C_PORT, &lis_r);

        bool fall = false;
        if (lis_r.valid)
            fall = lis3dh_update_fall_detection(&fall_state, &lis_r, now);

        /* Emit one JSON line. Fields for failed reads report ok:false. */
        printf("{\"t_ms\":%lu,", (unsigned long)now);

        printf("\"max30102\":{\"ok\":%s", max_s.valid ? "true" : "false");
        if (max_s.valid)
            printf(",\"red\":%lu,\"ir\":%lu",
                   (unsigned long)max_s.red, (unsigned long)max_s.ir);
        printf("},");

        printf("\"bmp280\":{\"ok\":%s", bmp_r.valid ? "true" : "false");
        if (bmp_r.valid)
            printf(",\"temp_c\":%.2f,\"press_pa\":%.1f,\"alt_m\":%.1f",
                   bmp_r.temperature_c, bmp_r.pressure_pa, bmp_r.altitude_m);
        printf("},");

        printf("\"lis3dh\":{\"ok\":%s", lis_r.valid ? "true" : "false");
        if (lis_r.valid)
            printf(",\"x_g\":%.3f,\"y_g\":%.3f,\"z_g\":%.3f,\"mag_g\":%.3f",
                   lis_r.x_g, lis_r.y_g, lis_r.z_g, lis_r.magnitude_g);
        printf("},");

        printf("\"fall_detected\":%s}\n", fall ? "true" : "false");

        sleep_ms(LOOP_PERIOD_MS);
    }
    /* not reached */
    return 0;
}
