---
title: Runtime
description: nano-ros core runtime, language rules, memory model, and deterministic scheduling.
---

## Language and compilation

The nano-ros core is C11. No VLAs, no `alloca`, and no function like macros with side effects.

The `hardware_interface` layer uses a minimal C++ subset. No RTTI and no exceptions. `-fno-exceptions -fno-rtti` is mandatory.

| Target family | Toolchain | Notes |
|---|---|---|
| ARM Cortex-M/A | `arm-none-eabi-gcc` | Zephyr, FreeRTOS, NuttX targets |
| RISC-V RV64GC | `riscv64-unknown-elf-gcc` | PolarFire SoC, NOEL-V targets |
| SPARC V8 | BCC2 | RTEMS qualified compiler for space targets |

## ROS 2 API surface

nano-ros exposes a narrow rclc subset.

| Primitive | Notes |
|---|---|
| `rcl_node_t` | One node per hardware interface instance |
| `rcl_publisher_t` | Joint state, sensor data, FDIR events |
| `rcl_subscription_t` | Joint command, lifecycle TC |
| `rcl_timer_t` | Control loop tick on an absolute timeline |
| `rclc_executor_t` | Single threaded spin loop with bounded handles |

Not included: actions, parameter server, TF, and dynamic types.

## Memory model

All buffers are declared at translation unit scope. No `malloc` call may appear in any hot path.

```c
static double joint_positions[NANO_ROS_MAX_JOINTS];
static double joint_velocities[NANO_ROS_MAX_JOINTS];
static double joint_efforts[NANO_ROS_MAX_JOINTS];
static double safe_commands[NANO_ROS_MAX_JOINTS];

static uint8_t tx_ring[NANO_ROS_TX_BUF_SIZE];
static uint8_t rx_ring[NANO_ROS_RX_BUF_SIZE];
```

## Scheduling

The control loop runs on an absolute timeline. Relative wakeup is banned because it accumulates drift.

```c
rtems_interval deadline = rtems_clock_get_ticks_since_boot();
const rtems_interval period = RTEMS_MILLISECONDS_TO_TICKS(1);

while (1) {
    deadline += period;
    hardware_interface_read();
    controller_update();
    hardware_interface_write();
    rtems_task_wake_after(deadline - rtems_clock_get_ticks_since_boot());
}
```

## hardware_interface base

```c
typedef struct nano_ros_hw_iface {
    int    (*read)(struct nano_ros_hw_iface *self);
    int    (*write)(struct nano_ros_hw_iface *self);
    int    (*init)(struct nano_ros_hw_iface *self, const char *urdf_name);
    double *states;
    double *commands;
    double *safe_cmds;
    uint8_t n_states;
    uint8_t n_commands;
    void   *base_addr;
} nano_ros_hw_iface_t;
```

When `base_addr` is NULL, the implementation uses an in memory buffer instead of hardware registers.
