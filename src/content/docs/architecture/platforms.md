---
title: Transport Overview
description: The Transport Abstraction Layer — tier model, TAL C interface, wire endianness invariant, and callback thread safety contract.
---

## What the TAL is

The Transport Abstraction Layer (TAL) is a five-function-pointer interface that separates application code and the hardware_interface from any transport-specific concerns. The TAL backend — SpaceWire/CCSDS, zenoh, 1553B, local shared SRAM, or nothing — is selected by a single CMake flag at configure time. Nothing above the TAL interface changes when the backend changes.

## TAL C interface

```c
typedef struct nano_ros_transport_ops {
    int  (*init)      (const nano_ros_transport_config_t *cfg);
    int  (*publish)   (uint16_t addr, const void *data, size_t len);
    int  (*subscribe) (uint16_t addr, nano_ros_rx_cb_t cb, void *user);
    void (*spin_once) (void);
    void (*deinit)    (void);
} nano_ros_transport_ops_t;
```

Every backend implements all five functions. The runtime calls only these five. A backend that is not available on a given target (e.g., SpaceWire on an MCU with no SpW controller) returns `NANO_ROS_ERR_UNSUPPORTED` from `init()` and is excluded from the CMake build for that target.

## Tier summary

| Tier | Name | Host transport | Serialization | Use case |
|---|---|---|---|---|
| T0 | Space | SpaceWire + CCSDS | CCSDS Space Packet (big-endian) | Space missions, no IP stack |
| T1 | ROS-compatible | zenoh-pico + CDR | micro-CDR (ROS IDL types) | Max observability, `ros2 topic echo` |
| T2 | Lightweight | zenoh-pico | Raw float64 (big-endian) | Standard robotics, low overhead |
| T3 | Bit-optimal | zenoh-pico | URDF-generated packed binary | High-frequency, bandwidth-constrained |
| T4 | Defense | MIL-STD-1553B | CCSDS-framed (big-endian) | Defense/aerospace, legacy integration |
| Ti | Local | Shared SRAM or SpW-RMAP | Fixed-frame binary (big-endian) | MCU ↔ FPGA/SoC intra-system |
| Tx | Standalone | None | N/A | Fully autonomous, no host |

## Wire endianness invariant

:::caution[Invariant — all TAL wire formats are big-endian]
All multi-byte fields on all TAL wire formats use network byte order (big-endian). This applies to: float64 joint payloads, CCSDS headers, sequence counters, CDS timestamps, Ti tier frames, and the version handshake packet.
:::

SPARC V8 (LEON3/4/5) is natively big-endian and requires no swap. RISC-V (NOEL-V, PolarFire SoC, RP2350 Hazard3) and ARM (Cortex-M, SAMRH707, VA5) are little-endian and require byte swaps at all serialization boundaries.

```c
/* platforms/<target>/nano_ros_endian.h */

#if defined(NANO_ROS_PLATFORM_SPARC)
  #define NANO_ROS_HTON64(x)  (x)
  #define NANO_ROS_NTOH64(x)  (x)
  #define NANO_ROS_HTON32(x)  (x)
  #define NANO_ROS_NTOH32(x)  (x)
#elif defined(NANO_ROS_PLATFORM_RISCV) || defined(NANO_ROS_PLATFORM_ARM)
  #define NANO_ROS_HTON64(x)  __builtin_bswap64(x)
  #define NANO_ROS_NTOH64(x)  __builtin_bswap64(x)
  #define NANO_ROS_HTON32(x)  __builtin_bswap32(x)
  #define NANO_ROS_NTOH32(x)  __builtin_bswap32(x)
#else
  #error "NANO_ROS_PLATFORM_* not defined — check platforms/<target>/nano_ros_endian.h"
#endif
```

The byte-swap macros are applied inside the TAL backend at the serialization boundary. Application code and the hardware_interface layer are never endianness-aware.

## Callback thread safety contract

Subscribe callbacks (`nano_ros_rx_cb_t`) have an explicit calling-context contract per backend. Callbacks are **never** called from an ISR context in any backend. ISRs set a flag or post to a semaphore; the `NR_TRANSPORT` task wakes and calls the callback. Calling rclc executor functions from an ISR is illegal on RTEMS.

| Backend | Callback calling context | Notes |
|---|---|---|
| zenoh-pico (T1/T2/T3) | `NR_TRANSPORT` RTOS task | May call rclc executor primitives. Must not block. |
| CCSDS/SpW (T0) | `NR_TRANSPORT` RTOS task | GRSPW2 DMA → enqueue → task wakes → callback. |
| 1553B (T4) | `NR_TRANSPORT` RTOS task | GR1553B interrupt → semaphore → task wakes → callback. |
| Ti Shared SRAM | `NR_CTRL` task (poll-based) | Polled in control loop. No semaphore, no ISR. |
| Ti SpW-RMAP | `NR_TRANSPORT` RTOS task | RMAP reply → `NR_TRANSPORT` → callback. |

## URDF version handshake

Tier 3 (bit-optimal) and Tier 0 (APID-based) are vulnerable to silent misparse when the host URDF and firmware URDF are out of sync — for example after a URDF update without a firmware reflash.

ros_HDL generates `nanoros_urdf_version.h` with a 32-bit truncation of the SHA-256 hash of the URDF `<ros2_control>` block:

```c
#define NANO_ROS_URDF_HASH  0xA3F21C8BUL
```

On link-up (first packet exchange after transport init), the hash is exchanged with the host. On mismatch:

1. Firmware rejects all incoming TC
2. FDIR event emitted on APID 0x301 (`NANO_ROS_FDIR_VERSION_MISMATCH`)
3. TAL enters `LINK_MISMATCH` hold — no joint payload is parsed
4. Recovery requires a lifecycle reset TC with `force_version_accept` flag (operator override)

## TAL benchmark

The standard benchmark for any new backend: 7 joints at 1 kHz for 10 seconds.

| Metric | Target |
|---|---|
| Mean latency | < 1 ms (Ethernet / zenoh) |
| Max latency | < 5 ms |
| Jitter | < 200 µs |
| CPU load (RTOS) | < 20% on LEON3 at 50 MHz |

Benchmark results are published in `docs/transport_benchmark.md` in the repository and updated for each new backend.