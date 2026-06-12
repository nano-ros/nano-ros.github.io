---
title: MCU Companion
description: The independent rad-hard MCU companion node — FPGA configuration guardian, hard-RT FOC loop, power health surveillance, and hardware-level FDIR independent of nano-ros software.
---

## Purpose

The MCU companion is not a compute node. It is a hardware safety net that runs independently of nano-ros software on a separate, simpler rad-hard microcontroller. Its presence means that a nano-ros software freeze cannot prevent hardware recovery.

**Four responsibilities:**

1. **Configuration management** — Load the FPGA bitstream via SelectMAP, scrub configuration SRAM to correct SEU-induced bit flips, and manage the FPGA boot sequence after any reset or power cycle.

2. **Hard real-time actuation** — Run the 10 kHz FOC commutation loop for motor joints. Deterministic hard-RT that cannot be delegated to an RTOS with non-deterministic scheduling paths in the critical commutation window.

3. **Health surveillance** — Monitor bus voltage, current draw, and junction temperature at 100 Hz. Assert latch-up protection by power-cycling the FPGA on overcurrent events within 1 ms.

4. **Independent FDIR** — Watch the nano-ros heartbeat written to the Ti shared SRAM frame. If absent beyond the timeout, assert FPGA reset or full power cycle — regardless of nano-ros software state.

## Target hardware

| MCU | ISA | Manufacturer | Radiation tolerance | Primary pairing |
|---|---|---|---|---|
| **GR716B** | SPARC V8 (LEON3FT) | Frontgrade Gaisler | TID ≥ 100 krad, SEL immune | GR712RC / GR740 |
| **SAMRH707** | ARM Cortex-M7 | STMicroelectronics | TID 300 krad, SEL immune (125 MeV) | General purpose |
| **VA5** | ARM Cortex-M7 | Microchip | TID 300 krad, SEL immune | RT PolarFire SoC / NeXCon |

The MCU firmware is a separate, minimal binary — not nano-ros. On GR716B it runs RTEMS or bare-metal C. It does not expose a ROS 2 API and is not subject to ros2_HDL code generation.

## Local bus matrix

| Bus | Protocol | Direction | Use case |
|---|---|---|---|
| SelectMAP | FPGA configuration bus | MCU → FPGA | Bitstream load, SRAM scrub, boot sequencing |
| SpW / RMAP | SpaceWire + ECSS-E-ST-50-52C | Bidirectional | Joint setpoints and state (Ti fallback) |
| SPI-for-Space | SPI with CRC | MCU → FPGA | Health register reads, slow-path monitoring |
| Shared SRAM | Dual-port SRAM | Bidirectional | Ti primary path — hard-RT FOC setpoints |
| CAN FD | CAN FD | Bidirectional | Secondary health/telemetry, redundant check |

## FPGA guardian boot sequence

```
POWER_ON:
  MCU asserts FPGA_RESET (active low)
  MCU loads configuration bitstream via SelectMAP
  MCU releases FPGA_RESET
  MCU starts heartbeat watchdog timer (T = 5 s)
  Wait for nano-ros heartbeat on Ti shared SRAM or CAN FD

  heartbeat received within T → NOMINAL
  timeout → increment reset_count in NVRAM
    reset_count ≤ 3 → retry from POWER_ON
    reset_count > 3 → POWER_CYCLE

NOMINAL:
  Heartbeat watchdog: expected 10 Hz, alarm at 1 s absence
  Scrub cycle: configuration readback via SelectMAP,
               correct single-bit errors (SEU)
  Health ADC: V · I · T polled at 100 Hz
  Latch-up guard: I > I_latchup → POWER_CYCLE (< 1 ms)

POWER_CYCLE:
  Open SEL protection relay
  Wait 100 ms (capacitor discharge)
  Close relay
  Reload configuration from NOR flash
  Resume from POWER_ON
```

`reset_count` is stored in NVRAM and transmitted in the APID 0x303 reset event so ground operators can distinguish planned from fault-induced resets.

## Hard-RT FOC at 10 kHz

nano-ros (1 kHz) writes a setpoint to the Ti shared SRAM frame. The MCU reads this setpoint and closes the inner FOC loop at 10 kHz, independent of the RTOS scheduler running on the FPGA/SoC. This decouples commutation timing from nano-ros task jitter.

```
nano-ros (1 kHz) → setpoint in Ti SRAM → MCU FOC loop (10 kHz) → PWM output
```

The MCU's 10 kHz loop reads the latest setpoint from shared SRAM at each tick. If nano-ros has not written a new setpoint since the last tick (because it is mid-calculation at 1 kHz), the MCU uses the last valid setpoint. The control loop does not stall.

On FDIR entry, nano-ros writes `safe_commands` to the Ti SRAM frame. The MCU reads this at the next 10 kHz tick and transitions the motor to its safe position within 100 µs.

## MCU FDIR vs nano-ros FDIR

The two FDIR layers operate in parallel and do not share software state:

| | nano-ros FDIR (software) | MCU FDIR (hardware-adjacent) |
|---|---|---|
| Detects | Transport faults, stale commands, bounds violations, CRC errors, version mismatch | nano-ros heartbeat absence, power anomalies, latch-up |
| Output | Joint safe-hold, PUS ST[5] events on APID 0x301 | Physical FPGA reset or power cycle |
| Recovers from | Software-level faults with a recovery TC from host | RTOS freeze, hardware overcurrent, any state not reachable by software |

A nano-ros software freeze that prevents the FDIR state machine from running is invisible to nano-ros FDIR but is detected by the MCU within 10 seconds. The MCU asserts FPGA reset. nano-ros then restores sequence counters from NVRAM, transmits the APID 0x303 reset event, and returns to NOMINAL.

## Security stubs

Two security-related features are reserved for Phase 2 (Q1 2027):

**SDLS — TC authentication.** A `nano_ros_auth_ops_t` plugin interface is reserved in the TAL receive path so mission integrators can insert CCSDS SDLS (CCSDS 355.0-B-2) without modifying core nano-ros code.

**CFDP — in-orbit firmware update.** The MCU boot sequence includes a dual-bank image slot managed by the MCU bootloader. CCSDS File Delivery Protocol (CCSDS 727.0-B-5) is the planned delivery mechanism. The slot pointers and CFDP delivery flag are defined in NVRAM now so nano-ros firmware is designed without assuming control of its own update path.