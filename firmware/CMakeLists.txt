# CMakeLists.txt — Ghost Medic sensor-hub firmware (Raspberry Pi Pico / RP2040)
#
# Standard Pico SDK build. Assumes the Pico SDK is available and PICO_SDK_PATH
# is set (or the pico_sdk_import.cmake shim below can locate it).
#
# Typical build:
#   mkdir build && cd build
#   cmake ..            # (or: cmake -DPICO_SDK_PATH=/path/to/pico-sdk ..)
#   make
# Produces ghost_medic_firmware.uf2 — drag onto the Pico's RPI-RP2 drive
# while holding BOOTSEL.

cmake_minimum_required(VERSION 3.13)

# Pull in the Pico SDK. This file ships with the SDK; copy it next to this
# CMakeLists or rely on the VS Code Pico extension / PICO_SDK_PATH.
include(pico_sdk_import.cmake)

project(ghost_medic_firmware C CXX ASM)

set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)

# Initialise the SDK (sets up toolchain, board headers, etc.).
pico_sdk_init()

add_executable(ghost_medic_firmware
    main.c
    max30102.c
    bmp280.c
    lis3dh.c
)

# Link the SDK libraries we use:
#   pico_stdlib     — core runtime, GPIO, timers, stdio
#   hardware_i2c    — the I2C peripheral API (hardware/i2c.h)
target_link_libraries(ghost_medic_firmware
    pico_stdlib
    hardware_i2c
)

# Route stdio (printf) over USB CDC serial, not the UART pins.
# 1 = enable, 0 = disable.
pico_enable_stdio_usb(ghost_medic_firmware 1)
pico_enable_stdio_uart(ghost_medic_firmware 0)

# Generate .uf2, .hex, .bin, .map alongside the .elf.
pico_add_extra_outputs(ghost_medic_firmware)
