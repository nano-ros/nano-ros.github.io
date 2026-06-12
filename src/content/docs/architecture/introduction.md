---
title: Introduction
description: Why nano-ros exists, the gaps it fills, and the design invariants that govern every architectural decision.
sidebar:
  order: 0
---

## Why nano-ros exists

Three existing tools each cover part of the embedded ROS 2 problem. None of them covers it fully.

**micro-ROS** is the standard solution for ROS 2 on microcontrollers. The `rmw_zenoh` path removes the XRCE-DDS agent requirement — but `ros2_control hardware_interface` is still not implemented on any RTOS. Every joint driven by a microcontroller remains a dumb serial endpoint. The controller lives on the Linux host and treats the RTOS as raw I/O.

**Space ROS** (NASA + Blue Origin + PickNik, FFR mission February 2026) is a Linux-host framework. There is no embedded firmware layer. The `ros2_control` boundary stops at the Linux host. The actuator never becomes a first-class ROS 2 node.

**Standard `ros2_control`** hardware_interface implementations run on Linux. Writing one for an FPGA-attached peripheral means maintaining the register map twice — once in HDL for synthesis, once in C/C++ for the driver.

A fourth gap appears at the hardware level: on radiation-hardened systems, the FPGA running nano-ros needs an independent, simpler companion MCU that can boot-sequence it, scrub its configuration memory, monitor power health, and assert a hard reset or power cycle when the FPGA firmware becomes unresponsive. No existing embedded robotics stack addresses this layer.

## The four gaps

| Gap | Solution |
|---|---|
| micro-ROS has no `ros2_control` on any RTOS | nano-ros exposes `hardware_interface` natively on the RTOS |
| Space ROS has no embedded firmware layer | nano-ros space tier on RTEMS + SpaceWire/CCSDS transport |
| FPGA register maps written twice (HDL and C) | ros_HDL generates the C binding with unit scaling from VHDL source |
| FPGA needs an independent hardware guardian | MCU companion node: FPGA boot, scrub, health monitor, watchdog reset |

## Design principles

These are invariants. Every architectural decision in nano-ros is checked against them. None of them may be relaxed to simplify a feature.

**1. Zero dynamic allocation after init.**
No `malloc`, no `new` in any hot path. Every buffer is statically allocated at translation-unit scope. Execution time is mathematically bounded. `NANO_ROS_MAX_JOINTS` and all buffer sizes are compile-time constants fully visible at link time.

**2. URDF is the source of truth for topology.**
Joint names, interface types, unit scaling factors, safe-position values, and CCSDS APID allocation all derive from the URDF `<ros2_control>` block. Nothing is hand-coded.

**3. HDL is the source of truth for hardware.**
The VHDL entity port map defines the `ros2_control hardware_interface`. ros_HDL generates the binding including unit scaling. The register map is never written twice. (v1.0 supports VHDL only; Verilog/SystemVerilog is a tracked future deliverable.)

**4. Transport is a compile-time choice, not an architecture.**
Application code, hardware_interface implementations, and FDIR logic are transport-agnostic. Swapping zenoh for SpaceWire or 1553B requires one CMake flag. Nothing above the Transport Abstraction Layer (TAL) changes.

**5. Wire endianness is always network byte order (big-endian).**
All multi-byte fields on every TAL wire format use big-endian encoding. Per-platform byte-swap macros are mandatory at the serialization boundary. Application code is never endianness-aware.

**6. Space-grade from day one.**
Static memory, bounded execution, FDIR hooks, per-joint safe-position configuration, and NVRAM sequence counters are the baseline design — not features added later for certification.

**7. The MCU companion and the FPGA/SoC node are architecturally independent.**
The MCU can observe, reset, and power-cycle the FPGA without cooperation from nano-ros software. This independence is the fundamental safety invariant for radiation-hardened systems. No shared software state crosses this boundary.

## What nano-ros is not

nano-ros is not a generic middleware platform and does not compete with micro-ROS on industrial Cortex-M targets where micro-ROS is mature. nano-ros targets the gap where micro-ROS has no offering: RTEMS, space transport, FPGA peripherals, and the MCU + FPGA co-design pattern for radiation-hardened systems.

nano-ros is not a motion planning framework. Planning, path execution, and autonomy live on the Space ROS or ROS 2 host. nano-ros is the firmware runtime that turns the host's `ros2_control` commands into physical actuator motion and returns real sensor data.