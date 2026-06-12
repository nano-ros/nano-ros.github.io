---
title: Platform Matrix
description: Full platform support matrix for FPGA and SoC targets, MCU companion options, RTOS support, and industrial MCU targets.
---

## FPGA and SoC targets

| Platform | Processor | ISA | RTOS | Radiation | Status |
|---|---|---|---|---|---|
| RT PolarFire SoC | RISC-V RV64GC plus NOEL-V | RISC-V | RTEMS plus Zephyr | Flash based, no config upsets | Primary dev target |
| GR712RC | LEON3-FT dual core | SPARC V8 | RTEMS 6 | 300 krad TID | Primary space deploy target |
| GR740 | LEON4-FT quad core | SPARC V8 | RTEMS 6 SMP | 300 krad, SEL immune | Space target |
| GR765 | LEON5 plus NOEL-V octa | SPARC plus RISC-V | RTEMS 6 SMP | Rad hard | Tracked |
| GR801 | NOEL-V | RISC-V RV64 | RTEMS 6 | Rad hard | AI in space |
| RTG4 plus LEON3FT | LEON3-FT soft core | SPARC V8 | RTEMS | Rad tolerant antifuse | FPGA only option |
| Virtex 5QV | LEON3FT soft core | SPARC V8 | RTEMS | Space qualified SRAM FPGA | Scrubber required |

## MCU companion targets

| MCU | ISA | Manufacturer | Radiation | Pairing |
|---|---|---|---|---|
| GR716B | SPARC V8 | Frontgrade Gaisler | TID 100 krad plus | GR712RC and GR740 |
| SAMRH707 | ARM Cortex-M7 | STMicroelectronics | TID 300 krad | General purpose |
| VA5 | ARM Cortex-M7 | Microchip | TID 300 krad | RT PolarFire SoC |

## RTOS support

| RTOS | Tier | Key targets | Notes |
|---|---|---|---|
| RTEMS 6 | Tier 1 | LEON3, LEON4, LEON5, NOEL-V, PolarFire SoC | Space qualified |
| Zephyr RTOS | Tier 1 | NeXCon, STM32, RP2350, ESP32 | Industrial |
| NuttX | Tier 2 | NXP S32K, RP2350 | POSIX compatible |
| FreeRTOS | Tier 2 | ESP32, STM32 | Lowest bring up cost |

## Industrial MCU targets

| MCU | ISA | RTOS | Notes |
|---|---|---|---|
| STM32 | ARM Cortex-M4 or M7 | Zephyr or FreeRTOS | Industrial baseline |
| RP2350 | RISC-V plus ARM | Zephyr or FreeRTOS | Dual core, low cost |
| NXP S32K | ARM Cortex-M7 | NuttX or Zephyr | Automotive target |
| ESP32-S3 | Xtensa LX7 | FreeRTOS or Zephyr | Demo board target |
