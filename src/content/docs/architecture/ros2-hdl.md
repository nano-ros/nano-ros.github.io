---
title: ros2_HDL
description: ros2_HDL code generation from VHDL entity port maps and URDF ros2_control blocks into nano-ros hardware interface bindings.
---

## What ros2_HDL is

ros2_HDL is a Python based code generator. It runs as a CMake pre build step before any C or C++ compilation. Its job is to eliminate the dual maintenance problem. Without it, every FPGA peripheral needs a register map in HDL for synthesis and another register map in C for the driver.

ros2_HDL is not a runtime component. It produces source files that are compiled into the nano-ros firmware.

## Scope

:::note[v1.0 parser scope]
Version 1.0 supports VHDL entity parsing only. Verilog and SystemVerilog use different syntax and require separate parsers, so they are tracked future work.
:::

## Two inputs

### Input A, URDF `<ros2_control>` block

```xml
<ros2_control name="joint_1" type="actuator">
  <hardware>
    <plugin>nano_ros/GRPWMHardwareInterface</plugin>
    <param name="grlib_device_id">0x00D</param>

    <param name="enc_count.counts_per_rev">4096</param>
    <param name="enc_count.unit">rad</param>
    <param name="enc_vel.scale_factor">0.00153398</param>
    <param name="enc_vel.unit">rad/s</param>
    <param name="pwm_out.scale_factor">255.0</param>
    <param name="pwm_out.offset">0.0</param>
    <param name="pwm_out.unit">normalized</param>

    <param name="safe_command.position">0.0</param>
  </hardware>
  <joint name="joint_1">
    <command_interface name="position"/>
    <state_interface name="position"/>
    <state_interface name="velocity"/>
  </joint>
</ros2_control>
```

### Input B, VHDL entity port map

```vhdl
entity grpwm_peripheral is
  port (
    clk    : in  std_logic;
    rstn   : in  std_logic;
    apbi   : in  apb_slv_in_type;
    apbo   : out apb_slv_out_type;
    pwm_out   : out std_logic_vector(7 downto 0);
    enc_count : in  std_logic_vector(31 downto 0);
    enc_vel   : in  std_logic_vector(31 downto 0)
  );
end entity;
```

## Port classification rules

| VHDL direction | ros2_control type | Notes |
|---|---|---|
| `out` | `CommandInterface` | RTOS writes to hardware |
| `in` | `StateInterface` | RTOS reads from hardware |

The following port names are excluded because they are AMBA bus infrastructure, not application ports: `apbi`, `apbo`, `ahbi`, `ahbo`, `clk`, `rstn`.

## The scaling layer

:::danger[Missing scaling is a hard error]
If scaling parameters are missing for any application port, ros2_HDL fails with an error. It never emits a silent raw cast.
:::

ros2_HDL applies scaling inside the generated `read()` and `write()` functions. Byte swap macros are applied at the register boundary.

```c
int nanoros_grpwm_read(nano_ros_hw_iface_t *iface) {
    uint32_t raw_count = NANO_ROS_NTOH32(GRPWM_READ32(iface->base_addr + GRPWM_REG_ENC_COUNT));
    uint32_t raw_vel   = NANO_ROS_NTOH32(GRPWM_READ32(iface->base_addr + GRPWM_REG_ENC_VEL));
    iface->states[STATE_POSITION] = ((double)raw_count / 4096.0) * 6.28318530718;
    iface->states[STATE_VELOCITY] = (double)raw_vel * 0.00153398;
    return NANO_ROS_OK;
}
```

## Generator flow

```text
URDF and VHDL
  -> parsers
  -> scaling and APID extraction
  -> code generation
  -> compiled firmware and mission database fragment
```

## Software simulation backend

The generated simulation backend uses the same interface as hardware but reads and writes an in memory buffer. That makes CI and host integration tests possible without FPGA hardware.
