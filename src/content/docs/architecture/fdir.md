---
title: FDIR
description: Fault detection, isolation, and recovery in nano-ros.
---

## Overview

FDIR is compiled into every nano-ros build that enables it. It is part of the architecture, not an add on.

## Detection table

| Fault | Detection mechanism | Threshold |
|---|---|---|
| Host transport link down | TAL link error callback | Immediate |
| Command timestamp stale | Sequence and age check | Configurable |
| Joint command out of bounds | Hardware interface bounds check | Per joint |
| Control loop deadline miss | Absolute timeline comparison | One missed period |
| Memory ECC error | BSP ECC handler callback | Configurable |
| CCSDS CRC mismatch | TAL parser | Configurable consecutive errors |
| URDF version mismatch | Hash comparison at link up | Immediate |

## Safe position configuration

Zero is not a safe position for every mechanism. Each command interface must define a safe position in the URDF.

## Recovery model

On fault, the system moves to safe hold and keeps telemetry alive. A recovery command can return the system to nominal if the transport is stable and the version hash matches.

## Fault injection

The software simulation backend exposes a fault injection API for CI testing so every fault path is covered by automated tests.
