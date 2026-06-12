---
title: Multi-Instance
description: Running multiple nano-ros nodes on a single FPGA/SoC — namespace conventions, APID partitioning, memory budget, and thread model for single-core and SMP targets.
---

## Overview

A single nano-ros deployment may host more than one hardware_interface node — for example, a dual-arm system where each arm's joints are driven by a separate node, or a redundant controller pair on the same SoC. All instances share the same firmware binary and are differentiated by namespace and APID base offset.

## Node namespace

Each nano-ros node takes a name and a namespace at `rcl_init()` time:

```c
rcl_node_init(&node_left,  "joint_controller", "/arm_left",  &context, &opts);
rcl_node_init(&node_right, "joint_controller", "/arm_right", &context, &opts);
```

Topic names are namespace-prefixed. Two nodes on the same platform publish to distinct zenoh topics or CCSDS APIDs — no collision. The hardware_interface name used for ros_HDL code generation and URDF lookup must match the node name.

## APID namespace for T0

Each node is assigned a base APID offset at CMake configure time. ros_HDL applies offsets within each node's assigned range:

```cmake
# CMakeLists.txt
set(NANO_ROS_APID_BASE_ARM_LEFT  0x100)  # uses 0x100–0x17F
set(NANO_ROS_APID_BASE_ARM_RIGHT 0x180)  # uses 0x180–0x1FF
```

Two nodes never share an APID. APID `0x300`–`0x303` (HK, events, lifecycle, reset event) are shared infrastructure and are emitted once per platform regardless of node count.

## Memory budget for multi-instance

Each additional node requires its own static buffer set. All buffers are declared at translation-unit scope with `NANO_ROS_MAX_NODES` as the first dimension:

```c
static double joint_positions [NANO_ROS_MAX_NODES][NANO_ROS_MAX_JOINTS];
static double joint_velocities[NANO_ROS_MAX_NODES][NANO_ROS_MAX_JOINTS];
static double joint_efforts   [NANO_ROS_MAX_NODES][NANO_ROS_MAX_JOINTS];
static double safe_commands   [NANO_ROS_MAX_NODES][NANO_ROS_MAX_JOINTS];
```

`NANO_ROS_MAX_NODES` is a compile-time constant. `tools/nano_ros_memcheck.py` reports per-node and aggregate memory usage in the post-link budget summary.

## Thread model

### Single-core (GR712RC — dual LEON3)

One `NR_CTRL` task per node, priority-separated. Node 0 at RTEMS priority 1, Node 1 at priority 2. Each task runs within its absolute-timeline budget. The higher-priority node preempts only if it misses a deadline — which is itself an FDIR event.

The Ti shared SRAM frame is extended with per-node regions if the MCU companion services multiple joints independently.

### Multi-core (GR740 quad, GR765 octa)

One `NR_CTRL` task per node, each pinned to a dedicated core via RTEMS SMP CPU affinity. Full hardware parallelism. The MCU companion is unaffected — it runs on its own independent processor regardless of the FPGA core count.

```c
/* RTEMS SMP — pin NR_CTRL tasks to specific cores */
rtems_task_set_affinity(node_left_task,  sizeof(cpu_set), &cpu_set_core0);
rtems_task_set_affinity(node_right_task, sizeof(cpu_set), &cpu_set_core1);
```

### Resource sharing

The Ti shared SRAM frame, NVRAM region, and CAN FD bus are shared infrastructure accessed by all nodes. Access to the Ti frame is governed by the CRC-32 field and the poll-only access model (no semaphore, no ISR). NVRAM writes are serialized through a single `NR_NVRAM` maintenance task.