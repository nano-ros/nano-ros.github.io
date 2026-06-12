---
title: Transport Overview
description: Backend agnostic transport design for nano-ros.
---

## What the transport layer is

The transport layer separates the application and hardware interface from transport specific concerns. The backend is selected at build time and can be SpaceWire, CCSDS, zenoh, 1553B, local shared SRAM, or none.

## Transport tiers

T1 is the default flight tier. T2 and T3 are secondary tiers for ROS compatible deployments. T4 is for legacy aerospace and defense integration.

| Tier | Name | Transport | Serialization | Use case |
|---|---|---|---|---|
| T1 | Space | SpaceWire plus CCSDS | CCSDS Space Packet | Space missions |
| T2 | ROS compatible | zenoh-pico plus CDR | micro CDR | High observability |
| T3 | Lightweight | zenoh-pico | Packed binary | Bandwidth constrained robotics |
| T4 | Defense | MIL-STD-1553B | CCSDS framed | Legacy aerospace |
| Ti | Local | Shared SRAM or SpW RMAP | Fixed frame binary | MCU to FPGA or SoC |
| Tx | Standalone | None | N/A | Fully autonomous |

## Wire endianness

All multi byte fields use network byte order. Application code and the hardware interface layer stay endianness agnostic.

## Callback contract

Callbacks run in a task context, never from ISR context.

## Benchmark

A good baseline is 7 joints at 1 kHz for 10 seconds.
