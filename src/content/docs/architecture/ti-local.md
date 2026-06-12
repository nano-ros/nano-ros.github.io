---
title: Ti — Local (MCU ↔ FPGA)
description: The local transport tier for intra-system communication between the MCU companion node and the nano-ros FPGA/SoC node — shared SRAM and SpW-RMAP.
---

## Overview

Ti (local tier) is not a host transport. It carries data between the MCU companion node and the nano-ros FPGA/SoC node on the same PCB. It has no APID, no zenoh topic, and is invisible to the Space ROS host.

Ti is how nano-ros (running at 1 kHz) writes joint setpoints to the MCU companion's hard-RT FOC loop (running at 10 kHz). The MCU reads the setpoint and closes the inner commutation loop independently of the RTOS scheduler. This decouples commutation timing from nano-ros task jitter.

## Ti via Shared SRAM (primary path)

Shared SRAM is the preferred Ti backend for platforms with dual-port SRAM on-chip or an external SRAM bank accessible to both the MCU and the FPGA/SoC.

```c
/* Shared SRAM layout — compile-time contract between MCU firmware and nano-ros */
typedef struct __attribute__((packed)) {
    uint32_t sequence;           /* MCU writes; monotonic counter */
    uint32_t mcu_status;         /* MCU health flags: V · I · T · latch-up */
    uint32_t setpoint_position;  /* MCU → nano-ros: FOC setpoint (float32, big-endian) */
    uint32_t setpoint_velocity;
    uint32_t state_position;     /* nano-ros → MCU: current joint state (float32, big-endian) */
    uint32_t state_velocity;
    uint32_t nano_ros_heartbeat; /* nano-ros writes at 10 Hz; MCU reads for watchdog */
    uint32_t crc32;              /* CRC-32 of all preceding fields */
} nano_ros_ti_frame_t;
```

All fields are big-endian (network byte order) per the wire endianness invariant. The CRC-32 covers all preceding fields and detects torn reads across cache line boundaries.

nano-ros polls this frame in the `NR_CTRL` task at 1 kHz — no ISR, no semaphore. The MCU reads `nano_ros_heartbeat` independently at 10 Hz to feed its watchdog.

### Linker placement

The Ti frame is placed in the `SRAM_SHARED` memory region by the linker script:

```c
static volatile nano_ros_ti_frame_t g_ti_rx __attribute__((section(".nano_ros_ti")));
static volatile nano_ros_ti_frame_t g_ti_tx __attribute__((section(".nano_ros_ti")));
```

The `.nano_ros_ti` section maps to `SRAM_SHARED` in the platform linker script. The MCU firmware accesses the same physical address through its own linker configuration.

## Ti via SpW-RMAP (fallback)

For platforms without dual-port SRAM, Ti uses SpaceWire RMAP (Remote Memory Access Protocol, ECSS-E-ST-50-52C).

The MCU acts as RMAP initiator. nano-ros exposes a bounded RMAP target window backed by the `nano_ros_ti_frame_t` struct. RMAP read/write commands replace shared SRAM access with identical frame semantics.

Callback for RMAP replies runs in the `NR_TRANSPORT` RTOS task — not ISR context. Same thread safety contract as all other backends.

## FOC setpoint flow

```
nano-ros control loop (1 kHz)
  → writes setpoint to g_ti_tx (shared SRAM)

MCU FOC loop (10 kHz)
  → reads setpoint from g_ti_rx (same physical SRAM)
  → closes inner FOC commutation loop
  → writes PWM to motor driver

nano-ros FDIR
  → on fault: writes safe_command to g_ti_tx
  → MCU reads safe_command at next 10 kHz tick
  → motor transitions to safe position within 100 µs
```

The MCU companion's independent FDIR also monitors `nano_ros_heartbeat`. If it has not been updated for 10 seconds, the MCU asserts FPGA reset regardless of the Ti frame content. See [MCU Companion](/architecture/mcu-companion/) for the full hardware FDIR path.