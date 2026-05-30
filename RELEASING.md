# Releasing

Releases are driven by [Changesets](https://github.com/changesets/changesets)
and published from CI with npm trusted publishing (OIDC provenance). You never
run `npm publish` by hand.

## 1. Add a changeset with your change

Any PR that affects the published package includes a changeset:

```bash
pnpm changeset
```

It asks for the bump type and a summary, then writes a markdown file in
`.changeset/`. Commit it with your code.

Bump types (semver):

- **patch** — bug fix, no API change (`2.0.0 → 2.0.1`)
- **minor** — backward-compatible feature (`2.0.0 → 2.1.0`)
- **major** — breaking change (`2.0.0 → 3.0.0`)

Docs-, CI-, and test-only changes don't need a changeset.

## 2. Merge your PR into `main`

When a commit carrying changesets lands on `main`, the Publish workflow runs the
Changesets action, which opens (or updates) a **"chore: release"** PR. That PR:

- bumps `version` in `package.json`,
- writes the new section in `CHANGELOG.md`,
- deletes the consumed changeset files.

It does **not** publish yet.

## 3. Merge the "chore: release" PR

Merging it pushes `main` with no pending changesets. The workflow then runs
`changeset publish`, which builds and publishes the new version to npm as
`latest`, with provenance.

```
your PR (+changeset) ─merge→ main ─▶ "chore: release" PR ─merge→ main ─▶ npm publish
```

## Prereleases (`next`)

The workflow also publishes from a `next` branch (for `next`-tagged prereleases).
Use Changesets prerelease mode on that branch:

```bash
pnpm changeset pre enter next   # start
# ...normal changeset + release-PR flow, versions become x.y.z-next.N...
pnpm changeset pre exit         # stop before promoting to a stable release
```

## Notes

- The version in `package.json` is owned by Changesets — don't bump it by hand.
- A published npm version is immutable; you can't republish the same number.
  Ship a new patch instead.
