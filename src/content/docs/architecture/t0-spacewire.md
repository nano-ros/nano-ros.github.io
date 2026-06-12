---
title: T0 — SpaceWire / CCSDS
description: The space transport tier — SpaceWire physical layer, CCSDS Space Packet framing, APID allocation, sequence counter persistence, PUS service subset, and time synchronization.
---

## Overview

Tier 0 is the space transport tier. It carries CCSDS Space Packets (CCSDS 133.0-B-2) over SpaceWire (ECSS-E-ST-50-12C) and is the required transport for ESA/NASA mission deployments. It has no IP stack dependency. GRLIB provides the `GRSPW2` IP core on LEON and PolarFire SoC targets.

## Wire format

```
[SpW destination path]              1+ bytes — routing node addresses
[Protocol ID: 0xFE]                 1 byte — CCSDS over SpaceWire (ESA assigned)
[CCSDS primary header: 6 bytes]
  version(3b) + type(1b) + SHF(1b) + APID(11b)
  sequence flags(2b) + sequence count(14b)
  data length(16b)
[CCSDS secondary header: 8 bytes]
  CDS day(16b) + ms-of-day(32b) + sub-ms(16b)
[Joint payload: N × 8 bytes]        float64, network byte order (big-endian)
[CRC-CCITT: 2 bytes]                optional, mission-configurable
[SpW EOP]
```

All multi-byte fields are big-endian. On little-endian targets (RISC-V, ARM), `NANO_ROS_HTON64` is applied to each float64 payload field before transmission.

## APID allocation

APIDs are 11-bit fields assigned automatically by ros_HDL from the URDF hardware_interface index.

| APID range | Purpose |
|---|---|
| `0x100`–`0x1FF` | Joint state TM — one APID per hardware_interface |
| `0x200`–`0x2FF` | Joint command TC — one APID per hardware_interface |
| `0x300` | Heartbeat / housekeeping TM (PUS ST[3]) |
| `0x301` | FDIR event TM (PUS ST[5]) |
| `0x302` | Lifecycle TC (configure / activate / deactivate) |
| `0x303` | Reset event TM — sequence counter resync |
| `0x7FF` | Reserved |

For multi-instance deployments, each node gets a distinct base APID offset via `NANO_ROS_APID_BASE_<NODE>` in CMake. Two nodes never share an APID.

## Sequence counter on reset

YAMCS and SCOS-2000 track per-APID sequence counters and flag discontinuities as loss-of-frame events. A watchdog reset that starts the sequence counter from 0 is misinterpreted by ground systems as a packet gap.

**Policy:**

1. Each per-APID sequence counter is persisted to NVRAM (MRAM on GR712RC, FeRAM on PolarFire SoC) every 10 seconds and on every FDIR state transition.
2. On any reset, nano-ros reads the persisted counter and resumes from `persisted_value + 1`.
3. On first boot after factory flash (no persisted counter), APID 0x303 is transmitted before any other TM, instructing ground systems to resynchronize.
4. On any subsequent reset where NVRAM is readable, APID 0x303 is still transmitted with the cumulative reset count.

```c
/* Reset event TM packet payload — APID 0x303 */
typedef struct __attribute__((packed)) {
    uint16_t event_id;     /* 0x0001 = cold start; 0x0002 = watchdog reset */
    uint32_t reset_count;  /* total resets since factory flash, from NVRAM */
    uint8_t  fdir_cause;   /* last FDIR state before reset (0 = none) */
    uint8_t  nvram_valid;  /* 1 = counters restored; 0 = cold start */
    uint8_t  pad[2];
} nano_ros_reset_event_t;
```

## Time synchronization

CDS timestamps require a time source synchronized to UTC. T0 has no GPS receiver — time correlation comes from the OBC via PUS ST[9].

**Primary path (mission operational):** PUS Time Management Service ST[9], subtype 9/1. The OBC sends a time correlation TC. nano-ros updates the GRLIB GRtimer epoch via RTEMS `rtems_clock_set_tod()`. Subsequent CDS timestamps derive from GRtimer at microsecond resolution. PUS ST[9] implementation is a blocking prerequisite for GR712RC hardware bring-up.

**Fallback (development):** Free-running GRtimer from an arbitrary epoch. YAMCS accepts relative-time-only mode. CDS day field set to 0 to signal non-synchronized time.

| Platform | Time source | Sync mechanism |
|---|---|---|
| GR712RC / GR740 / GR765 | GRLIB GRtimer | PUS ST[9] TC via GRSPW2 |
| RT PolarFire SoC | RISC-V `mtime` | PUS ST[9] TC via zenoh or SpW |
| TSIM | TSIM virtual clock | Simulated ST[9] injection in test script |

## PUS service subset

Packet structures are PUS-conformant (ECSS-E-ST-70-41C) so YAMCS and SCOS-2000 decode them natively with the generated MDB XML.

**PUS ST[3] — Housekeeping report (APID 0x300):**

```
[CCSDS primary header: APID=0x300, type=TM]
[CCSDS secondary header: CDS timestamp]
[PUS data field: service_type=3, service_subtype=25, source_ID]
[SID: 16 bits]                Structure ID — URDF-assigned, one per hardware_interface
[collection_interval: 16 bits]
[N_params: 16 bits]           = 3 × N_joints
[joint_position[0]: 64 bits]  float64, big-endian
[joint_velocity[0]: 64 bits]
[joint_effort[0]: 64 bits]
...
[joint_effort[N-1]: 64 bits]
[CRC-CCITT: 16 bits]
```

**Complete PUS service implementation list:**

| PUS service | Type | Subtype | Description |
|---|---|---|---|
| ST[1] | 1 | 1, 7 | TC acceptance success / failure |
| ST[3] | 3 | 25 | HK report |
| ST[5] | 5 | 1–4 | Event: INFO / WARNING / ERROR / CRITICAL |
| ST[9] | 9 | 1 | Time correlation TC |
| ST[17] | 17 | 1, 2 | Test (ping / pong) |

## YAMCS integration

The YAMCS Mission Database XML generated by `tools/ros_hdl/yamcs_mdb_gen.py` defines the PUS ST[3] structure for every hardware_interface. After loading this fragment, YAMCS decodes HK packets and displays joint state in engineering units without any custom scripting or post-processing.

For development, the TSIM LEON3 simulator provides a virtual SpaceWire loopback. YAMCS can connect to nano-ros running on TSIM and receive CCSDS TM before any physical hardware is available.