<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Architecture Overview

```
                         +-------------+
                         |  Frontend   |
                         +------+------+
                                |
           +--------------------+---------------------+
           |                    |                     |
   +-------v------+     +-------v-------+     +-------v-------+
   | Companion API|     | Onboarding API|     | Partner Hooks |
   +-------+------+     +-------+-------+     +-------+-------+
           |                    |                     |
   +-------v--------------------v---------------------v-------+
   |                   Core Engine & Modules                  |
   +--+-------------+--------------+--------------+-----------+
      |             |              |              |
+-----v---+   +-----v----+   +-----v----+   +-----v----+
| Fitness |   |  Music   |   |  Gaming  |   |  Plugins |
|  Layer  |   |  Layer   |   |Extensions|   |          |
+---------+   +----------+   +----------+   +----------+
      |             |              |              |
      +-------------+--------------+--------------+
                    |
               +----v----+
               |Database|
               +--------+
```
