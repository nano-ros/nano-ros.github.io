---
title: FDIR
description: Fault Detection, Isolation, and Recovery in nano-ros — detection table, safe-position configuration, recovery state machine, PUS events, and the fault injection test framework.
---

## Overview

FDIR (Fault Detection, Isolation, Recovery) is compiled into every nano-ros build that sets `NANO_ROS_FDIR_ENABLE`. It is not an add-on and not optional for space or safety-critical deployments. The nano-ros FDIR layer operates in parallel with the MCU companion's independent hardware FDIR — they do not share state and detect different fault classes.

## Detection table

| Fault | Detection mechanism | Threshold |
|---|---|---|
| Host transport link down | TAL link-error callback | Immediate |
| Command timestamp stale | CDS/sequence delta check | 200 ms default, configurable |
| Joint command out of bounds | `hardware_interface` bounds check vs URDF limits | Per-joint |
| Control loop deadline miss | Absolute-timeline comparison in `NR_CTRL` task | 1 missed period |
| Memory ECC error (SEU) | RTEMS BSP ECC handler callback | Configurable accumulator |
| CCSDS CRC mismatch | TAL CCSDS parser | 3 consecutive errors |
| URDF version mismatch | Hash comparison at TAL link-up | Immediate |

The MCU companion independently detects: nano-ros heartbeat absence (10 s timeout), power anomalies (V/I/T), and latch-up events. Its response is physical: FPGA reset or power cycle. See [MCU Companion](/architecture/mcu-companion/) for the hardware FDIR path.

## Safe-position configuration

:::danger[Zero is not a safe position]
For a gravitationally-loaded manipulator arm, setting all joint commands to zero on fault means uncontrolled fall. ros_HDL fails with an error if `safe_command` is absent for any `CommandInterface` in the URDF. There is no default. Every joint's safe position is a deliberate mission configuration.
:::

Safe positions are specified in the URDF `<ros2_control>` block and generated into the firmware as a static array:

```c
/* Generated in nanoros_<name>_hw.c from URDF safe_command params */
static const double safe_commands[NANO_ROS_MAX_JOINTS] = {
    0.0,     /* joint_0: gravitationally neutral at 0 rad */
    1.5708,  /* joint_1: gravitationally balanced at 90 deg */
    /* ... one entry per CommandInterface, URDF-defined */
};

void nano_ros_fdir_enter_safe_hold(nano_ros_hw_iface_t *iface) {
    for (uint8_t i = 0; i < iface->n_commands; i++) {
        iface->commands[i] = safe_commands[i];
    }
    iface->ops->write(iface);
}
```

## Recovery state machine

```
NOMINAL
  │ fault detected (any row in detection table above)
  ▼
SAFE_HOLD
  All joints → safe_command values (per-joint, URDF-defined)
  TAL continues operating (link kept alive)
  HK TM continues broadcasting (APID 0x300)
  FDIR event TM emitted (APID 0x301, PUS ST[5])
  Sequence counters flushed to NVRAM
  Waiting for recovery TC on APID 0x302

  │ recovery TC received AND link stable AND version hash matches
  ▼
NOMINAL

  │ timeout (default 30 s) — no recovery TC received
  ▼
AUTONOMOUS_SAFE
  All outputs physically disabled (PWM zeroed, DAC to safe voltage)
  Sequence counters flushed to NVRAM
  RTEMS watchdog fires after M seconds
  ↓ post-reset
  Restore sequence counters from NVRAM
  Transmit APID 0x303 reset event
  → NOMINAL (Tx standalone mode)
  → Await host link (T0–T4 modes)
```

## PUS ST[5] event reporting

Every FDIR state transition emits a CCSDS TM packet on APID 0x301:

```
[APID=0x301, type=TM]
[CDS timestamp: 8 bytes]
[PUS data field: service_type=5, service_subtype=1–4]
[event ID: 16 bits]
[severity: 8 bits  — INFO=1 / WARNING=2 / ERROR=3 / CRITICAL=4]
[param0: 32 bits]
[param1: 32 bits]
[CRC-CCITT: 16 bits]
```

YAMCS and SCOS-2000 parse this natively with the generated YAMCS Mission Database XML.

## Fault injection test framework

The software simulation backend exposes a `nano_ros_fault_inject()` API for CI testing. All fault paths are tested on the Linux host with no hardware required.

```c
typedef enum {
    NANO_ROS_FAULT_LINK_DOWN        = 0,
    NANO_ROS_FAULT_STALE_COMMAND    = 1,   /* param = staleness in ms */
    NANO_ROS_FAULT_COMMAND_OOB      = 2,   /* param = joint index */
    NANO_ROS_FAULT_DEADLINE_MISS    = 3,
    NANO_ROS_FAULT_ECC_ERROR        = 4,
    NANO_ROS_FAULT_CRC_MISMATCH     = 5,   /* param = consecutive count */
    NANO_ROS_FAULT_VERSION_MISMATCH = 6,
} nano_ros_fault_type_t;

int nano_ros_fault_inject(nano_ros_fault_type_t fault, uint32_t param);
```

Each fault type has a CI test case that:

1. Starts nano-ros in simulation mode (Linux host, no RTOS, no FPGA)
2. Injects the fault via `nano_ros_fault_inject()`
3. Asserts the state machine reaches `SAFE_HOLD` or `AUTONOMOUS_SAFE`
4. For recoverable faults: sends a recovery TC and asserts return to `NOMINAL`
5. Verifies the correct PUS ST[5] event on APID 0x301

All fault injection tests are mapped to requirements in the traceability matrix. A PR that adds a new fault detection path without a corresponding test and traceability entry fails CI.