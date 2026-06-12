---
title: Introduction
description: Why nano-ros exists, the gaps it fills, and the design rules that govern every architectural decision.
sidebar:
  order: 1
---

## Why nano-ros exists

Three existing tools each cover part of the embedded ROS 2 problem. None of them covers it fully.

**micro-ROS** is strong for microcontrollers, but the architecture here needs native `ros2_control` on RTOS targets and a firmware runtime that can be part of the actuator node itself.

**Space ROS** is a host side stack for space robotics. nano-ros fills the embedded firmware layer below the host and makes the actuator a first class node.

**Standard `ros2_control`** hardware interface implementations usually live on Linux. For FPGA attached peripherals, that means maintaining the register map twice, once in HDL and once in C or C++.

A fourth gap appears at the hardware level. On radiation hardened systems, the FPGA or SoC running nano-ros needs an independent companion MCU that can boot it, scrub it, monitor power health, and reset or power cycle it if software becomes unresponsive.

## The four gaps

| Gap | Solution |
|---|---|
| Embedded ROS 2 needs native `ros2_control` on RTOS | nano-ros exposes `hardware_interface` natively |
| Space systems need a firmware layer below the host | nano-ros adds a Space tier on RTEMS |
| FPGA register maps get duplicated | ros2_HDL generates the binding from VHDL and URDF |
| FPGA recovery must not depend on the firmware | MCU companion handles boot, scrub, and reset |

## Design rules

These are the rules the architecture should keep.

1. Zero dynamic allocation after init.
2. URDF is the source of truth for topology, units, safe positions, and APID allocation.
3. VHDL is the source of truth for hardware.
4. Transport is a compile time choice, not an architectural dependency.
5. All wire formats use network byte order.
6. Space grade behavior is the baseline.
7. The MCU companion and the FPGA or SoC node remain independent.

## What nano-ros is not

nano-ros is not a general middleware platform. It does not try to replace the full ROS 2 stack on Linux.

nano-ros is not a motion planning framework. Planning and autonomy stay on the host. nano-ros turns host commands into deterministic actuator behavior and state feedback.
