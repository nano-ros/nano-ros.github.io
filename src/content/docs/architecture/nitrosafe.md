---
title: NitroSafe Architecture
description: nano-ros architecture for embedded and real-time ROS 2 systems.
sidebar:
  order: 1
---

## Overview

nano-ros is a deterministic ROS 2 client for embedded and real-time systems.  
It is designed to keep the runtime path predictable, while allowing hardware and transport layers to vary by target.

## Architecture layers

### 1. Application layer
This is where robot logic lives:
- publishers
- subscribers
- services
- actions
- control loops

### 2. Interface layer
This layer connects hardware and device protocols to ROS 2 concepts.

Supported and planned interface families can include:
- ros2_control hardware interfaces
- EtherCAT
- CAN
- GPIO
- custom device adapters

### 3. Runtime layer
This layer keeps execution behavior deterministic:
- static or bounded memory usage
- predictable scheduling
- no heap dependence in the hot path
- compile-time sizing where possible

### 4. Transport layer
This layer is backend-agnostic.

Possible transport backends:
- serial
- TCP
- raw Ethernet
- target-specific backends

### 5. Platform layer
This layer handles the target operating system and board support package.

Current focus:
- RTEMS
- Zephyr

## Design principles

- keep the transport replaceable
- keep the interface layer separate from the runtime
- keep memory behavior predictable
- keep the website aligned with the real implementation
- keep platform support narrow and current

## ROS 2 compatibility

The project can present compatibility notes for:
- ROS 2 Lyrical Luth
- ROS 2 Rolling

## What this architecture page should say

nano-ros is not a generic middleware platform.  
It is a focused embedded ROS 2 client stack with clear layers for application logic, hardware interfaces, runtime behavior, transport, and platform integration.