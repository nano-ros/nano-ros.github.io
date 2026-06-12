---
title: Space Targets
description: Space-grade and radiation-tolerant FPGA and SoC targets supported by nano-ros — Gaisler LEON family, RT PolarFire SoC, and radiation-hardened FPGA options.
---

## RT PolarFire SoC — primary development target

The RT PolarFire SoC integrates a 5-core RISC-V CPU cluster with programmable FPGA fabric on a single 28 nm FD-SOI die. The flash-based configuration memory does not upset under radiation — there are zero configuration upsets, which eliminates the SRAM scrub requirement that SRAM FPGAs carry. Libero SoC (Microchip's synthesis toolchain) is permanently free on Linux with no tier restrictions.

At ROSCon 2025 in Singapore, ELISA demonstrated Space Grade Linux with Space-ROS running on PolarFire SoC hardware, confirming the hardware and software stack that the space robotics community is converging on.

**NeXCon** (GoMyRobot's reference hardware) uses the RT PolarFire SoC with a NOEL-V soft-core in FPGA fabric and GRSPW2 IP for SpaceWire I/O. The VA5 rad-hard Cortex-M7 serves as the MCU companion.

- **Processor:** 4× SiFive U54 application cores + 1× SiFive E51 monitor core, up to 460K logic elements
- **RTOS:** RTEMS 6 (PolarFire SoC BSP upstream) and Zephyr
- **Transport:** T0 (SpaceWire via GRSPW2 in fabric) and T2 (zenoh on Ethernet)
- **MCU companion:** VA5 (Microchip rad-hard Cortex-M7)

## GR712RC — primary space-deploy target

The GR712RC is a dual LEON3-FT processor in a rad-hard package. It has established ESA and NASA flight heritage, is tested to 300 krad TID, and is SEL immune. It is the most directly path to ESA/NASA mission qualification.

- **Processor:** 2× LEON3-FT at up to 50 MHz
- **RTOS:** RTEMS 6, BCC2 toolchain required
- **Transport:** T0 (SpaceWire via on-chip GRSPW2), T4 (1553B via GR1553B)
- **Development:** TSIM3 (Frontgrade Gaisler instruction-set simulator) covers most GR712RC testing without hardware; GRMON3 debugger for JTAG bring-up
- **MCU companion:** GR716B (same SPARC V8 ISA, direct firmware reuse)

## GR740

Quad LEON4-FT with RTEMS 6 SMP support. 300 krad TID, SEL immune. Suitable for compute-intensive missions where GR712RC's dual LEON3 is insufficient.

- **Processor:** 4× LEON4-FT
- **RTOS:** RTEMS 6 SMP
- **Multi-instance:** Four `NR_CTRL` tasks pinned to separate cores via CPU affinity

## GR765

Octa-core LEON5 + NOEL-V hybrid, announced April 2026. RTEMS SMP Qualification Data Package (QDP) in progress as an ESA-funded project (embedded brains). nano-ros will add GR765 to the platform matrix once the upstream RTEMS BSP is available.

- **Processor:** LEON5 (SPARC) + NOEL-V (RISC-V) in hybrid configuration
- **RTOS:** RTEMS 6 SMP (QDP completion tracked upstream)
- **Status:** No blocking dependency — platform matrix addition when BSP upstream is complete

## GR801

NOEL-V RISC-V processor from Frontgrade Gaisler's GRAIN AI-in-space product line. Rad-hard, targeting on-board AI inference for space missions.

## RTG4 + LEON3FT soft-core

Microsemi/Microchip RTG4 antifuse FPGA with a LEON3FT soft-core. Rad-tolerant (antifuse, no configuration upsets). FPGA-only option for missions that cannot use a commercial SoC die.

## Xilinx Virtex 5QV

Space-qualified SRAM FPGA. LEON3FT soft-core. Requires configuration scrubbing because it is SRAM-based — the MCU companion's SelectMAP scrub cycle is mandatory on this platform. Established flight heritage on multiple missions.

## GRLIB

All LEON-family targets use GRLIB (Gaisler Research IP Library) for AMBA bus infrastructure and on-chip peripherals. The key cores for nano-ros:

| GRLIB core | Function |
|---|---|
| GRSPW2 | SpaceWire controller (T0 TAL backend) |
| GR1553B | MIL-STD-1553B controller (T4 TAL backend) |
| GRPWM | PWM + quadrature encoder (motor joint hardware_interface) |
| GRGPIO | GPIO (digital I/O hardware_interface) |
| GRCAN | CAN FD controller (CAN joint hardware_interface) |
| GRADCDAC | ADC/DAC (analog sensor/actuator hardware_interface) |
| GRtimer | Hardware timer (absolute timeline scheduling, PUS ST[9] sync) |

GRLIB is available under GPL for open-source use and commercial license for proprietary use.