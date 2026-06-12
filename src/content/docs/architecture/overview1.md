---
title: Platform Matrix
description: Full platform support matrix — FPGA/SoC targets, MCU companion options, RTOS support, and industrial MCU targets.
---

## FPGA / SoC targets (nano-ros runs here)

| Platform | Processor | ISA | RTOS | Radiation | Status |
|---|---|---|---|---|---|
| **RT PolarFire SoC** | RISC-V RV64GC + NOEL-V | RISC-V | RTEMS + Zephyr | Zero config upsets (flash-based) | Primary dev target — NeXCon |
| **GR712RC** | LEON3-FT dual-core | SPARC V8 | RTEMS 6 | 300 krad TID | Primary space-deploy target |
| **GR740** | LEON4-FT quad-core | SPARC V8 | RTEMS 6 SMP | 300 krad, SEL immune | ESA NGMP |
| **GR765** | LEON5 + NOEL-V octa | SPARC + RISC-V | RTEMS 6 SMP (QDP in progress) | Rad-hard | New Apr 2026 — tracked |
| GR801 | NOEL-V | RISC-V RV64 | RTEMS 6 | Rad-hard | AI in space (GRAIN product line) |
| RTG4 + LEON3FT | LEON3-FT soft-core | SPARC V8 | RTEMS | Rad-tolerant antifuse | FPGA-only option |
| Xilinx Virtex 5QV | LEON3FT soft-core | SPARC V8 | RTEMS | Space-qualified SRAM FPGA | Scrubber required |

## MCU companion targets (runs alongside nano-ros)

| MCU | ISA | Manufacturer | Radiation | Pairing |
|---|---|---|---|---|
| **GR716B** | SPARC V8 (LEON3FT) | Frontgrade Gaisler | TID ≥ 100 krad, SEL immune | GR712RC / GR740 |
| **SAMRH707** | ARM Cortex-M7 | STMicroelectronics | TID 300 krad, SEL immune | General purpose |
| **VA5** | ARM Cortex-M7 | Microchip | TID 300 krad, SEL immune | RT PolarFire SoC |

## RTOS support

| RTOS | Tier | Key targets | Notes |
|---|---|---|---|
| RTEMS 6 | Tier 1 — primary | LEON3/4/5, NOEL-V, PolarFire SoC | Space-qualified; BCC2 required for SPARC |
| Zephyr RTOS | Tier 1 — primary | NeXCon, STM32, RP2350, ESP32 | Industrial; zenoh native module |
| NuttX | Tier 2 | NXP S32K, RP2350 | POSIX-compatible; good for automotive |
| FreeRTOS | Tier 2 | ESP32, STM32 | Pendulum demo, lowest bring-up cost |

## Industrial MCU targets

| MCU | ISA | RTOS | Notes |
|---|---|---|---|
| STM32 (Cortex-M4/M7) | ARM | Zephyr / FreeRTOS | Industrial baseline |
| RP2350 (Hazard3 + M33) | RISC-V + ARM | Zephyr / FreeRTOS | Dual-core, low cost |
| NXP S32K (Cortex-M7) | ARM | NuttX / Zephyr | Automotive ASIL-B target |
| ESP32-S3 (Xtensa LX7) | Xtensa | FreeRTOS / Zephyr | Pendulum demo board |