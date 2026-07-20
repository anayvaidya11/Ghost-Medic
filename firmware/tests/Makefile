# Makefile — host-side unit tests for the Ghost Medic sensor math.
#
# These build with your laptop's normal gcc (NOT the ARM cross-compiler) and
# run on your laptop. No Pico, no hardware. They compile the PURE math modules
# from ../ together with the test programs here.
#
# Usage:
#   make        # build both test binaries and run them
#   make build  # just build
#   make clean  # remove built binaries
#
# `make` exits non-zero if any test fails, so it also works in CI.

CC      := gcc
CFLAGS  := -Wall -Wextra -std=c11 -I..
LDLIBS  := -lm

TESTS   := test_bmp280 test_fall

.PHONY: all build run clean
all: run

build: $(TESTS)

# Each test links against the matching pure module from the parent firmware dir.
test_bmp280: test_bmp280.c ../bmp280_compensation.c ../bmp280_compensation.h
	$(CC) $(CFLAGS) test_bmp280.c ../bmp280_compensation.c $(LDLIBS) -o $@

test_fall: test_fall.c ../fall_detection.c ../fall_detection.h
	$(CC) $(CFLAGS) test_fall.c ../fall_detection.c $(LDLIBS) -o $@

# Run every test; `set -e` makes the target fail if any binary returns non-zero.
run: build
	@echo
	@set -e; for t in $(TESTS); do echo "Running ./$$t"; ./$$t; done
	@echo "All host tests passed."

clean:
	rm -f $(TESTS)
