---
title: ros2_HDL
description: ros2_HDL — code generation from VHDL entity port maps and URDF ros2_control blocks into nano-ros hardware_interface C bindings.
---

## What ros2_HDL is

ros2_HDL is a Python-based code generator. It runs as a CMake pre-build step before any C/C++ compilation. Its job is to eliminate the dual maintenance problem: without it, every FPGA peripheral requires a register map in HDL for synthesis and a separate register map in C for the driver. With ros2_HDL, the VHDL entity is the single source of truth.

ros2_HDL is not a runtime component. It produces no binary artifacts. It produces C source files that are compiled into the nano-ros firmware.

## Scope

:::note[v1.0 parser scope]
Version 1.0 supports VHDL entity parsing only. VHDL and Verilog/SystemVerilog have incompatible port declaration syntax and require entirely separate parsers. Verilog/SystemVerilog support is a tracked future deliverable. Xilinx and Intel FPGA targets that use Verilog primitives are not supported in v1.0.
:::

## Two inputs

ros2_HDL takes two inputs for each peripheral:

### Input A — URDF `<ros2_control>` block

```xml
<ros2_control name="joint_1" type="actuator">
  <hardware>
    <plugin>nano_ros/GRPWMHardwareInterface</plugin>
    <param name="grlib_device_id">0x00D</param>

    <!-- Scaling — required; ros2_HDL fails with an error if missing -->
    <param name="enc_count.counts_per_rev">4096</param>
    <param name="enc_count.unit">rad</param>
    <param name="enc_vel.scale_factor">0.00153398</param>
    <param name="enc_vel.unit">rad/s</param>
    <param name="pwm_out.scale_factor">255.0</param>
    <param name="pwm_out.offset">0.0</param>
    <param name="pwm_out.unit">normalized</param>

    <!-- Safe position — required for all CommandInterface -->
    <param name="safe_command.position">0.0</param>
  </hardware>
  <joint name="joint_1">
    <command_interface name="position"/>
    <state_interface name="position"/>
    <state_interface name="velocity"/>
  </joint>
</ros2_control>
```

### Input B — VHDL entity port map

```vhdl
entity grpwm_peripheral is
  port (
    clk    : in  std_logic;
    rstn   : in  std_logic;
    -- APB bus interface (excluded by AMBA bus signal name pattern)
    apbi   : in  apb_slv_in_type;
    apbo   : out apb_slv_out_type;
    -- Application ports (these become hardware_interface members)
    pwm_out   : out std_logic_vector(7 downto 0);    -- command
    enc_count : in  std_logic_vector(31 downto 0);   -- state: position
    enc_vel   : in  std_logic_vector(31 downto 0)    -- state: velocity
  );
end entity;
```

## Port classification rules

| VHDL direction | ros2_control type | Notes |
|---|---|---|
| `out` | `CommandInterface` | Signals the RTOS writes to hardware |
| `in` | `StateInterface` | Signals the RTOS reads from hardware |

The following port name patterns are automatically excluded from classification because they are GRLIB AMBA bus infrastructure, not application ports: `apbi`, `apbo`, `ahbi`, `ahbo`, `clk`, `rstn`. Exclusion is by explicit pattern match — not by position in the port list.

## The units/scaling layer

:::danger[Missing scaling is a hard error]
The VHDL port map carries no semantic information about units, resolution, or offset. If scaling parameters are absent for any application port, ros2_HDL fails with an error. It never emits a silent raw cast. The error message names the missing parameter.
:::

ros2_HDL applies scaling inline in the generated `read()` and `write()` functions. The byte-swap macros are applied at the register read/write boundary to satisfy the wire endianness invariant (all multi-byte fields big-endian on the wire).

```c
/* Generated output — nanoros_grpwm_hw.c */

int nanoros_grpwm_read(nano_ros_hw_iface_t *iface) {
    uint32_t raw_count = NANO_ROS_NTOH32(
                            GRPWM_READ32(iface->base_addr + GRPWM_REG_ENC_COUNT));
    uint32_t raw_vel   = NANO_ROS_NTOH32(
                            GRPWM_READ32(iface->base_addr + GRPWM_REG_ENC_VEL));
    /* Generated: radians = (raw / counts_per_rev) × 2π */
    iface->states[STATE_POSITION] = ((double)raw_count / 4096.0) * 6.28318530718;
    iface->states[STATE_VELOCITY] = (double)raw_vel * 0.00153398;
    return NANO_ROS_OK;
}

int nanoros_grpwm_write(nano_ros_hw_iface_t *iface) {
    uint32_t duty = NANO_ROS_HTON32(
                        (uint32_t)(iface->commands[CMD_POSITION] * 255.0));
    GRPWM_WRITE32(iface->base_addr + GRPWM_REG_PWM_DUTY, duty);
    return NANO_ROS_OK;
}
```

## Generator flow

```
URDF ─────────────────────────────────────────────────┐
                                                       │
VHDL entity (v1.0 only)                               │
  ↓                                                    │
ros2_hdl_parser.py                                    │
  → {port_name, direction, width}                     │
  → excludes AMBA bus signals by name pattern         │
  ↓                                                    ↓
ros2_hdl_gen.py ←──────── ros2_hdl_urdf.py ───────────┘
  │                         → device_id, scaling params
  │                         → safe_command values
  │                         → APID assignment
  │                         → URDF SHA-256 hash
  ↓
nanoros_<name>_hw.h        ← register offsets, scaling constants
nanoros_<name>_hw.c        ← read()/write() with byte-swap + scaling
nanoros_<name>_sim.c       ← software stub (in-memory, no FPGA)
nanoros_transport_apid.h   ← CCSDS APID per hardware_interface
nanoros_urdf_version.h     ← 32-bit truncated URDF SHA-256 hash
nanoros_yamcs_mdb.xml      ← YAMCS Mission Database fragment
```

## CMake integration

```cmake
# cmake/ros2_hdl_codegen.cmake
ros2_hdl_generate(
  URDF   ${CMAKE_SOURCE_DIR}/robot.urdf
  HDL    ${CMAKE_SOURCE_DIR}/rtl/grpwm_peripheral.vhd
  OUTPUT ${CMAKE_BINARY_DIR}/generated
)
```

This runs `tools/ros2_hdl/ros2_hdl_gen.py` as a CMake pre-build step. No manual invocation required.

## Software simulation backend

`nanoros_<name>_sim.c` presents the same `nano_ros_hw_iface_t` interface as the hardware implementation but reads and writes to an in-memory buffer. Uses:

- Linux host integration tests with a real Space ROS Docker instance — no FPGA, no RTOS
- FDIR fault injection testing via `nano_ros_fault_inject()`
- All CI tests in Workstreams 1–3

```
Test mode:
  Space ROS host ──zenoh──► nano-ros (Linux, sim build)
                               hardware_interface ↕ in-memory stub
                               (no FPGA, no RTOS required)

Production mode:
  Space ROS ──SpW/CCSDS──► nano-ros (RTEMS on GR712RC)
                               hardware_interface ↕ GRLIB GRPWM registers
```

The application code, the TAL, and the FDIR layer are identical in both modes.

## YAMCS Mission Database generator

`tools/ros2_hdl/yamcs_mdb_gen.py` generates `nanoros_yamcs_mdb.xml` containing the PUS ST[3] housekeeping report structure definitions for every hardware_interface. YAMCS loads this at startup and decodes HK packets with no manual configuration. SID values are auto-generated from the URDF hardware_interface index by the same tool that assigns APIDs.

## Built-in GRLIB bindings

The following ship as pre-generated bindings — no VHDL input required for these:

| GRLIB core | Device ID | Interface type | Notes |
|---|---|---|---|
| GRPWM | 0x00D | PWM command + encoder state | Motor control |
| GRGPIO | 0x01A | GPIO command / state | Digital I/O |
| GRCAN | 0x019 | CAN hardware_interface | CAN FD joints |
| GRADCDAC | 0x034 | Analog sensor / actuator | ADC input, DAC output |
| GRSPW2 | 0x029 | TAL SpaceWire backend | Transport — not control |
| GRUART | 0x00C | TAL serial backend | Transport / debug |

All built-in bindings are verified against the GRLIB IP Library User's Manual register maps by `tools/verify_grlib_bindings.py`, which runs in CI against GRLIB 2024.1+.