---
title: Mapping modules
parent: 4-software-engineering/2-principles/4-mapping-modules
owner: diplo
preview: >-
  Every function abstracts a behavior and every call links two abstractions. A
  system is as complex as its modules are connected and as shallow as their
  abstractions are. Drawing that map lets a human follow a system without
  reading all its code; line counts show when a module gets out of control.
---
# Mapping modules

Each function is an abstraction over a more or less complex behavior. When a function calls another one, there is a link between the two abstractions. Modules and their links form a map.

## Complexity lives in the map

The complexity of a system follows from:

- how connected its modules are;
- how much their abstractions let a reader willingly ignore. A deep module hides a lot of implementation behind a small interface; a shallow module hides little.

More on this in [subsystem-architecture](https://github.com/Diplow/subsystem-architecture).

## Draw the map

Drawing the map is how a human keeps a good understanding of what is going on without reading all the code. The number of lines inside a module adds an indicator: it tells when the module is getting out of control.
