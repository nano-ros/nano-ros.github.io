---
title: Ti Local MCU FPGA
description: Local transport tier for intra system communication between the MCU companion and the nano-ros FPGA or SoC node.
---

## Overview

Ti is not a host transport. It carries data between the MCU companion node and the nano-ros FPGA or SoC node on the same board.

## Ti via Shared SRAM

Shared SRAM is the preferred Ti backend for platforms with dual port SRAM.

```c
typedef struct __attribute__((packed)) {
    uint32_t sequence;
    uint32_t mcu_status;
    uint32_t setpoint_position;
    uint32_t setpoint_velocity;
    uint32_t state_position;
    uint32_t state_velocity;
    uint32_t nano_ros_heartbeat;
    uint32_t crc32;
} nano_ros_ti_frame_t;
```

## Ti via SpW RMAP

For platforms without shared SRAM, Ti can use SpaceWire RMAP as a fallback.

## Control flow

nano-ros writes the setpoint. The MCU reads it and closes the inner FOC loop independently.
