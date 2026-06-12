---
title: Memory Model
description: Deterministic memory behavior in nano-ros.
sidebar:
  order: 4
---

# Memory Model

nano-ros is designed for deterministic execution.

The preferred model is:

- static allocation where possible
- bounded buffers in the runtime path
- no heap required in hot paths
- predictable message handling
- compile time sizing for embedded targets

The goal is to keep the real time path stable and easy to reason about.
