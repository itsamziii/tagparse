---
"tagparse": patch
---

Build with tsdown instead of tsup, unblocking TypeScript 7.

TypeScript 7's `typescript` package no longer exports the JS compiler API, which
broke tsup's bundled `rollup-plugin-dts` during declaration emit. tsdown uses
rolldown + a TS7-aware dts plugin, so `pnpm run build` works again.

The public API is unchanged and the published layout is the same; bundles are
slightly smaller. Building tagparse now requires Node `^22.18.0 || >=24.11.0` —
the package itself still supports Node >=18.
