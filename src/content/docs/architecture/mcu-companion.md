---
title: MCU Companion
description: The independent rad hard MCU companion node for FPGA configuration, hard real time actuation, health monitoring, and hardware level recovery.
---

## Purpose

The MCU companion is not a compute node. It is a hardware safety net that runs independently of nano-ros software on a separate rad hard microcontroller.

## Responsibilities

1. Configuration management. Load the FPGA bitstream, scrub configuration memory, and manage boot after reset or power cycle.
2. Hard real time actuation. Run the 10 kHz FOC commutation loop for motor joints.
3. Health surveillance. Monitor bus voltage, current draw, and temperature.
4. Independent recovery. Watch the nano-ros heartbeat and assert reset or power cycle if it disappears.

## Target hardware

| MCU | ISA | Manufacturer | Radiation tolerance | Primary pairing |
|---|---|---|---|---|
| GR716B | SPARC V8 | Frontgrade Gaisler | TID 100 krad plus | GR712RC, GR740 |
| SAMRH707 | ARM Cortex-M7 | STMicroelectronics | TID 300 krad | General purpose |
| VA5 | ARM Cortex-M7 | Microchip | TID 300 krad | RT PolarFire SoC |

The MCU firmware is separate from nano-ros and does not expose a ROS 2 API.

## Local bus matrix

| Bus | Protocol | Direction | Use case |
|---|---|---|---|
| SelectMAP | FPGA configuration bus | MCU -> FPGA | Bitstream load and scrub |
| SpW / RMAP | SpaceWire plus RMAP | Bidirectional | Ti fallback |
| SPI for Space | SPI with CRC | MCU -> FPGA | Health register reads |
| Shared SRAM | Dual port SRAM | Bidirectional | Ti primary path |
| CAN FD | CAN FD | Bidirectional | Secondary health and telemetry |

## Boot sequence

```text
POWER_ON
  MCU asserts FPGA reset
  MCU loads configuration
  MCU releases reset
  MCU starts heartbeat watchdog
  Wait for nano-ros heartbeat

heartbeat received -> NOMINAL
timeout -> retry or power cycle
```

## FDIR split

The MCU and nano-ros FDIR layers operate in parallel and do not share software state. The MCU handles hardware recovery. nano-ros handles software level fault detection and safe hold behavior.
