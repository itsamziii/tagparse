# Contributing to tagparse

Thanks for your interest in improving tagparse. This guide covers local setup,
the test/lint gate, and how releases are cut.

By participating you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Prerequisites

- **Node.js** `>=18`
- **pnpm** (the repo pins a version via `packageManager`; enable it with `corepack enable`)

## Setup

```bash
git clone https://github.com/itsamziii/tagparse.git
cd tagparse
pnpm install
```

## Development workflow

| Command | What it does |
| --- | --- |
| `pnpm test` | Run the test suite once (vitest) |
| `pnpm test:watch` | Watch mode |
| `pnpm run typecheck` | `tsc --noEmit` |
| `pnpm run check` | Biome lint + format, auto-fixing in place |
| `pnpm run lint` / `pnpm run format` | Lint only / format only |
| `pnpm run build` | Build ESM + CJS with tsup |
| `pnpm run bench` | Run the micro-benchmarks |
| `pnpm run ci` | The full gate: `typecheck && biome ci . && test` |

Run `pnpm run ci` before opening a PR — it is exactly what CI runs.

## Tests

- New behavior gets a test. Bug fixes get a regression test.
- Don't edit a test to make it pass unless the test itself is wrong — say so in the PR.

## Code style

- Biome is the source of truth (4-space indent, double quotes, semicolons). Run `pnpm run check`.
- Strict TypeScript. No `any` in the public API; prefer `unknown` + narrowing.
- Comments explain *why*, not *what*.

## Commits

Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
Keep the subject under ~50 chars; put the *why* in the body when it isn't obvious.

## Changesets

Every change that affects the published package needs a changeset:

```bash
pnpm changeset
```

Pick the bump type, write a one-line summary, and commit the generated file in
`.changeset/`. Docs/CI/test-only changes don't need one. See
[RELEASING.md](./RELEASING.md) for the full flow.

## Pull requests

1. Branch off `main`.
2. Keep the PR focused — one logical change.
3. `pnpm run ci` is green.
4. Add a changeset if the package changed.
5. Fill in the PR template.

`main` is the release branch; merging a changeset there opens an automated
release PR. You never publish to npm by hand.
