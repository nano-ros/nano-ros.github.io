---
title: Tx — Standalone
description: The standalone autonomous tier — no host transport, autonomous mission program, NVRAM checkpointing, and FDIR in fully disconnected mode.
---

## Overview

Tier Tx is selected when no host transport is available or required. `NANO_ROS_TRANSPORT_NONE`. The `publish` and `subscribe` ops are no-ops. `spin_once` runs a local loopback that delivers messages between publishers and subscribers within the same node.

Tx is the correct tier for fully autonomous inspection robots, planetary surface missions, or any deployment where the control loop must survive indefinitely without host contact.

## FDIR in autonomous mode

Host-dependent FDIR states (`SAFE_HOLD` waiting for recovery TC) are replaced with a self-recovering autonomous state machine:

```
NOMINAL
  │ fault detected (command OOB, deadline miss, ECC error)
  ▼
AUTONOMOUS_SAFE
  All joints → safe_command values (per-joint, URDF-defined — not zero)
  Onboard mission program suspended at next checkpoint boundary
  Health monitor continues
  PUS ST[5] events written to NVRAM event log (not transmitted)
  MCU companion continues heartbeat supervision independently
  Watchdog expires after M seconds
  ↓ post-reset, health check passes
  ▼
NOMINAL
  Mission program restores from last NVRAM checkpoint
  Resumes execution
```

Note: `SAFE_HOLD` (with host recovery TC) is bypassed in Tx mode. There is no host to send a TC. The system must recover autonomously.

## Autonomous mission program interface

Application code registers a mission program by implementing three callbacks:

```c
typedef struct {
    /* Mission logic — called by nano-ros at every control tick */
    int (*execute)    (nano_ros_mission_ctx_t *ctx);

    /* Persist mission state to NVRAM — called every 10 s and on FDIR entry */
    int (*checkpoint) (nano_ros_mission_ctx_t *ctx);

    /* Reload mission state from NVRAM — called on post-reset boot */
    int (*restore)    (nano_ros_mission_ctx_t *ctx);
} nano_ros_mission_t;
```

nano-ros calls `checkpoint()` at configurable intervals (default: every 10 seconds) and on every FDIR state transition. On post-reset boot, `restore()` is called before `execute()` resumes. The `hardware_interface` contract is identical between Tx and all other tiers — `execute()` interacts only with `nano_ros_hw_iface_t`, not with the transport.

## NVRAM checkpointing

All state that must survive a reset is written to NVRAM:

- Mission program state (via `checkpoint()`)
- Per-APID sequence counters (even in Tx mode — for post-mission log integrity)
- FDIR event log
- Reset count and last FDIR cause

The NVRAM region is mapped to `.nano_ros_nvram` in the linker script (MRAM on GR712RC, FeRAM on PolarFire SoC). The MCU companion's NOR flash also holds a backup of the configuration bitstream and bootloader image.

## Hardware_interface compatibility

The hardware_interface implementation is identical in Tx mode and all other tiers. A firmware binary compiled for T0 (SpaceWire) can be recompiled for Tx by changing one CMake flag. The joint control loop, FDIR layer, Ti tier, and ros_HDL-generated bindings are untouched.