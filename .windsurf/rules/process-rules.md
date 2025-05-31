---
trigger: always_on
---

When using nuxt 3 if you will use process.client or process.server instead use document as process.client and !document as process.server as the process.[env] values are depreciated.