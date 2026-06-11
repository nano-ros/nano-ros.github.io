---
title: Transport Layer
description: Backend-agnostic transport design for nano-ros.
sidebar:
  order: 5
---

# Transport Layer

The transport layer should stay backend-agnostic.

Possible backends include:

- serial
- TCP
- raw Ethernet
- board-specific transport adapters

This keeps nano-ros flexible across different embedded targets and RTOS environments.