---
title: System Overview
description: Full system architecture of nano-ros and ros2_HDL.
---

## One stack, three levels

The nano-ros stack has three physical levels that compose cleanly.

```text
SPACE ROS / ROS 2 HOST
ControllerManager, MoveIt, Nav2, RViz2
SystemInterface on the host side reads and writes the transport abstraction

        |
        | one backend selected at build time
        | T1 SpaceWire / CCSDS as the flight path
        | T2 zenoh, T3 packed binary, T4 1553B, or Ti local
        v

MCU NODE                         FPGA / SoC NODE
rad hard companion                nano-ros on RTOS
boot, scrub, health, reset        application, interface, runtime, transport, FDIR
```

## nano-ros layers

### Application layer

Publishers, subscribers, timers, services, and control loops. Mission logic lives here.

### Interface layer

Connects hardware and device protocols to ROS 2 concepts. Every joint, sensor, and actuator is exposed through a typed `hardware_interface`. The generated binding is the only thing that touches registers.

### Runtime layer

Keeps execution predictable with static or bounded memory, absolute timeline scheduling, and a bounded executor model.

### Transport layer

Backend agnostic publish and subscribe over a five function pointer interface. The backend can be SpaceWire, CCSDS, zenoh, 1553B, local shared SRAM, or none. T1 is the default flight path.

### FDIR layer

Fault detection, isolation, and recovery. Detects stale commands, bounds violations, deadline misses, ECC errors, CRC mismatches, and version mismatches. Faults move the system to safe positions, not to zero by default.

## ros2_HDL

ros2_HDL is a Python based code generator that runs before compilation. It takes a VHDL entity declaration and a URDF `<ros2_control>` block and produces:

- C header and source for the hardware interface
- simulation stub for CI
- APID assignment header
- URDF version hash header
- YAMCS mission database fragment

## MCU companion node

The MCU companion is a hardware safety net that runs independently of nano-ros software. It can recover the FPGA or SoC without any cooperation from the firmware.

The key invariant is simple: the companion can reset or power cycle the target even if nano-ros is frozen.
