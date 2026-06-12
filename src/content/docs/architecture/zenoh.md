---
title: T1 / T2 / T3 — zenoh
description: The three zenoh transport tiers — ROS-compatible CDR, lightweight raw float64, and bit-optimal URDF-generated packed binary.
---

## Overview

Tiers 1, 2, and 3 all use zenoh-pico as the transport and differ only in serialization format. T2 is the simplest and is implemented first. T3 is derived from T2 with URDF-generated packing. T1 is the most observable but the highest overhead.

## T2 — Lightweight (zenoh + raw float64)

**Implement this tier first.**

The payload is an 8-byte sequence counter followed by N × float64 joint values. No CDR, no string keys, no metadata on the wire. A generic host-side `SystemInterface` plugin deserializes it without any URDF-specific generated code on the host.

```
[sequence counter: 8 bytes]
[joint_position[0]: 8 bytes]  float64, big-endian
[joint_velocity[0]: 8 bytes]
[joint_effort[0]: 8 bytes]
...
[joint_effort[N-1]: 8 bytes]
```

**Reference benchmark:** 7 joints at 1 kHz on Ethernet. Target: mean latency < 1 ms, jitter < 200 µs.

## T3 — Bit-optimal (URDF-generated)

T3 extends ros_hdl_urdf.py to generate `nanoros_payload.h` with lexicographically sorted joint indices. A matching host-side `SystemInterface` plugin is generated from the same URDF revision. No metadata on the wire — only data.

Because there is no metadata, both sides must be generated from the same URDF. The URDF version handshake (SHA-256 hash exchange at link-up) is mandatory for T3. On hash mismatch the TAL enters `LINK_MISMATCH` hold state and emits APID 0x301 event `NANO_ROS_FDIR_VERSION_MISMATCH`.

**Expected gain over T2:** approximately 20% bandwidth reduction for 7 joints at 1 kHz (no per-message sequence counter or alignment padding).

## T1 — ROS-compatible (zenoh + CDR)

T1 adds the micro-CDR dependency and serializes full ROS IDL types (`sensor_msgs/JointState`). This is the most overhead of the three zenoh tiers but provides complete ROS 2 observability:

- `ros2 topic echo /joint_states` works directly from the terminal, no bridge
- `ros2 bag record` captures real joint data
- RViz2 can display joint state without any custom plugin

**Implement T1 last.** It is the most useful for debugging but the least efficient for production.

## Tier selection

```cmake
# CMakeLists.txt — select exactly one zenoh tier
set(NANO_ROS_TRANSPORT T2)   # or T1 or T3
```

The default for NeXCon / HELIX-7 reference deployment is T2. The default for ground-station integration testing is T1 (full observability). T3 is used for high-frequency joint updates where bandwidth is constrained.

## zenoh-pico RTEMS PAL

zenoh-pico's current production-quality RTOS support covers Zephyr, FreeRTOS, ESP-IDF, and Linux. The RTEMS platform abstraction layer (PAL) is a GSoC 2026 deliverable and is the prerequisite for T1/T2/T3 on RTEMS targets.

:::note[Contingency]
If the GSoC RTEMS PAL is not merged upstream by Q3 2026, nano-ros carries an internal zenoh-pico fork with the RTEMS PAL as a patch set. This is a documented maintenance liability. Tier 0 (SpaceWire/CCSDS) is not blocked by this — it runs directly on the RTEMS GRSPW2 driver. Only T1/T2/T3 on RTEMS depend on the PAL deliverable.
:::