---
title: T1 SpaceWire CCSDS
description: Space transport tier for flight systems using SpaceWire and CCSDS.
---

## Overview

Tier 1 is the primary space transport tier. It carries CCSDS Space Packets over SpaceWire and is the default flight path for space deployments.

## Wire format

- SpaceWire routing path
- CCSDS primary header
- CCSDS secondary header
- joint payload in big endian
- optional CRC

## APID allocation

APIDs are assigned automatically from the URDF hardware interface index.

| APID range | Purpose |
|---|---|
| 0x100 to 0x1FF | Joint state telemetry |
| 0x200 to 0x2FF | Joint command telecommand |
| 0x300 | Housekeeping telemetry |
| 0x301 | FDIR event telemetry |
| 0x302 | Lifecycle telecommand |
| 0x303 | Reset event telemetry |

## Sequence counter on reset

Sequence counters are persisted to NVRAM so ground systems do not misread a reset as packet loss.

## PUS service subset

The generated mission database supports housekeeping, events, time sync, and test packets.
