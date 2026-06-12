---
title: Multi Instance
description: Running multiple nano-ros nodes on a single FPGA or SoC.
---

## Overview

A single deployment may host more than one hardware interface node. Examples include dual arm systems and redundant controller pairs on the same SoC.

## Node namespace

Each nano-ros node takes a name and a namespace at init time.

```c
rcl_node_init(&node_left,  "joint_controller", "/arm_left",  &context, &opts);
rcl_node_init(&node_right, "joint_controller", "/arm_right", &context, &opts);
```

Topic names are namespace prefixed. Two nodes on the same platform publish to distinct topics or APIDs.

## APID namespace

Each node is assigned a base APID offset at configure time. Two nodes never share an APID.

## Memory budget

Each additional node requires its own static buffer set. All buffers are declared at translation unit scope.

## Thread model

Single core targets use priority separation. SMP targets pin one control task per node to a dedicated core.

## Resource sharing

The Ti shared SRAM frame, NVRAM region, and CAN FD bus are shared infrastructure. Access is serialized by the runtime design.
