---
title: T2 T3 zenoh
description: Low overhead ROS compatible transport tiers using zenoh.
---

## Overview

T2 and T3 are the ROS compatible transport tiers. They are useful for industrial deployments and for debugging on the host.

## T2

T2 keeps the payload simple and low overhead.

## T3

T3 is bit optimal and uses URDF generated packed binary payloads.

## Selection

Choose T2 when observability matters. Choose T3 when bandwidth matters.

## Version handshake

T3 uses a URDF version handshake to avoid silent decode mismatches.
