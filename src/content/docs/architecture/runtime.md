---
title: Runtime
description: nano-ros core runtime — language, rclc API surface, static memory model, linker script, and deterministic scheduling.
---

## Language and compilation

The nano-ros core is C11. No VLAs, no `alloca`, no function-like macros with side effects.

The `hardware_interface` layer uses a minimal C++ subset: an abstract base class and templates. No RTTI, no exceptions. `-fno-exceptions -fno-rtti` is mandatory on every target.

| Target family | Toolchain | Notes |
|---|---|---|
| ARM Cortex-M/A | `arm-none-eabi-gcc` | Zephyr, FreeRTOS, NuttX targets |
| RISC-V (RV64GC) | `riscv64-unknown-elf-gcc` | PolarFire SoC, NOEL-V targets |
| SPARC V8 (LEON3/4/5) | BCC2 | RTEMS-qualified compiler from Frontgrade Gaisler — required for space targets |

:::caution[C++ static constructors on RTEMS SPARC]
RTEMS on LEON3 compiled with BCC2 initializes `.init_array` sections, but the ordering relative to RTEMS task creation is BSP-specific and differs from GCC/ARM behavior. No C++ constructor in `.init_array` may access RTEMS services (`rtems_clock_get_*`, `rtems_task_*`, heap functions) before the RTEMS scheduler has started. Violations cause silent undefined behavior on TSIM and hard faults on real hardware. CI includes a dedicated TSIM LEON3 test that validates constructor execution order after reset. This test is a blocking gate before any GR712RC hardware bring-up.
:::

## ROS 2 API surface (rclc subset)

nano-ros exposes the following rclc primitives. Everything else lives on the host.

| Primitive | Notes |
|---|---|
| `rcl_node_t` | One node per hardware_interface instance |
| `rcl_publisher_t` | Joint state, sensor data, FDIR events |
| `rcl_subscription_t` | Joint command, lifecycle TC |
| `rcl_timer_t` | Control loop tick — absolute timeline only |
| `rclc_executor_t` | Single-threaded spin loop, bounded handle count |

Not included: actions, parameter server, TF, dynamic types. These remain on the host.

## rclc allocator injection

rclc pulls in `rcl` which pulls in `rcutils`. Both contain allocation paths that must be replaced with the static pool allocator. The correct approach is to inject a custom `rcl_allocator_t` at `rcl_init()` time:

```c
static nano_ros_pool_t g_pool;

static rcl_allocator_t pool_allocator = {
    .allocate      = nano_ros_pool_alloc,
    .deallocate    = nano_ros_pool_free,
    .reallocate    = nano_ros_pool_realloc,   /* returns NULL if new_size > old_size */
    .zero_allocate = nano_ros_pool_zalloc,
    .state         = &g_pool
};

rcl_init_options_t opts = rcl_get_zero_initialized_init_options();
rcl_init_options_set_allocator(&opts, &pool_allocator);
rcl_init(0, NULL, &opts, &context);
```

This requires either an upstream contribution to `rcl`/`rcutils` to fully respect the injected allocator, or a maintained patch set. nano-ros carries the patch set until upstreaming is complete. The upstream path is tracked as an open issue.

## Memory model

All buffers are declared at translation-unit scope. No `malloc` call may appear in any hot path. Memory budget is fully known at link time and enforced by a linker script assertion and a post-link budget script.

```c
/* Joint state buffers — file scope, zero-initialized */
static double joint_positions [NANO_ROS_MAX_JOINTS];
static double joint_velocities[NANO_ROS_MAX_JOINTS];
static double joint_efforts   [NANO_ROS_MAX_JOINTS];
static double safe_commands   [NANO_ROS_MAX_JOINTS];  /* per-joint, URDF-defined */

/* Transport ring buffers */
static uint8_t tx_ring[NANO_ROS_TX_BUF_SIZE];
static uint8_t rx_ring[NANO_ROS_RX_BUF_SIZE];

/* Ti tier shared SRAM window — placed in SRAM_SHARED by linker script */
static volatile nano_ros_ti_frame_t g_ti_rx __attribute__((section(".nano_ros_ti")));
static volatile nano_ros_ti_frame_t g_ti_tx __attribute__((section(".nano_ros_ti")));
```

`NANO_ROS_MAX_JOINTS`, `NANO_ROS_TX_BUF_SIZE`, `NANO_ROS_RX_BUF_SIZE`, and `NANO_ROS_MAX_NODES` are all compile-time constants defined in the platform's `memory_budget.h`.

## Linker script template

```ld
SECTIONS {
  .text   : { *(.text*)   } > FLASH
  .rodata : { *(.rodata*) } > FLASH
  .data   : { *(.data*)   } > SRAM AT > FLASH
  .bss    : { *(.bss*) *(COMMON) } > SRAM

  /* nano-ros static pools — in ECC-protected SRAM where available */
  .nano_ros_pool : {
    PROVIDE(__nano_ros_pool_start = .);
    *(.nano_ros_pool*)
    PROVIDE(__nano_ros_pool_end   = .);
  } > SRAM_ECC

  /* Ti shared window — dual-port SRAM or uncached region */
  .nano_ros_ti : {
    PROVIDE(__nano_ros_ti_start = .);
    *(.nano_ros_ti*)
    PROVIDE(__nano_ros_ti_end   = .);
  } > SRAM_SHARED

  /* NVRAM — sequence counters, FDIR state, checkpoint data */
  .nano_ros_nvram : {
    PROVIDE(__nano_ros_nvram_start = .);
    *(.nano_ros_nvram*)
    PROVIDE(__nano_ros_nvram_end   = .);
  } > MRAM  /* MRAM on GR712RC; FeRAM on PolarFire SoC */

  /* Build-time budget assertions */
  ASSERT((__nano_ros_pool_end - __nano_ros_pool_start) <= NANO_ROS_POOL_MAX,
         "ERROR: nano-ros pool exceeds NANO_ROS_POOL_MAX");
  ASSERT(SIZEOF(.bss) <= NANO_ROS_BSS_MAX,
         "ERROR: nano-ros BSS exceeds NANO_ROS_BSS_MAX");
}
```

`NANO_ROS_POOL_MAX` and `NANO_ROS_BSS_MAX` are defined in `platforms/<target>/memory_budget.h`. The post-link script `tools/nano_ros_memcheck.py` reads the `.map` file and prints a structured budget summary (code, data, BSS, pool, Ti, NVRAM, total) with pass/fail against the platform budget.

## Scheduling — no missed ticks

The control loop runs on an absolute timeline. Relative wakeup (`rtems_task_wake_after()` with a tick count from now) is banned because each call drifts by the scheduler latency of that invocation. Only absolute-timeline wakeup is permitted.

```c
/* Absolute timeline — RTEMS 1 kHz example */
rtems_interval deadline = rtems_clock_get_ticks_since_boot();
const rtems_interval period = RTEMS_MILLISECONDS_TO_TICKS(1);

while (1) {
    deadline += period;
    hardware_interface_read();
    controller_update();
    hardware_interface_write();
    /* Sleep until the next absolute deadline, not "1 ms from now" */
    rtems_task_wake_after(deadline - rtems_clock_get_ticks_since_boot());
}
```

CI target: 1 kHz control loop jitter < 50 µs measured on TSIM LEON3 simulation.

## hardware_interface base

The hardware_interface is a C abstract interface. ros_HDL generates a concrete implementation. Application code interacts only with this abstraction.

```c
typedef struct nano_ros_hw_iface {
    int    (*read)  (struct nano_ros_hw_iface *self);
    int    (*write) (struct nano_ros_hw_iface *self);
    int    (*init)  (struct nano_ros_hw_iface *self, const char *urdf_name);
    double *states;     /* pointer into static joint_positions/velocities/efforts arrays */
    double *commands;   /* pointer into static joint commands array */
    double *safe_cmds;  /* pointer into static safe_commands array — FDIR writes here */
    uint8_t n_states;
    uint8_t n_commands;
    void   *base_addr;  /* MMIO base address; NULL for software simulation backend */
} nano_ros_hw_iface_t;
```

When `base_addr` is NULL, the implementation generated by ros_HDL reads and writes to an in-memory buffer instead of hardware registers. This simulation backend is used for all CI tests and Space ROS integration tests that do not require real hardware.