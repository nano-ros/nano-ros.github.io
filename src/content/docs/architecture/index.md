---
title: Architecture
description: Overview of the nano-ros architecture.
sidebar:
  order: 0
---

# Architecture

nano-ros is organized as a small set of clean layers:

- application
- interface
- runtime
- transport
- platform

The detailed pages below explain how the Space first design fits together. Space transport is the default flight path, and the rest of the stack is built around that assumption.
