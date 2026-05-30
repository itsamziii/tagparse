# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| `2.x`   | ✅ |
| `< 2.0` | ❌ |

Fixes land on the latest `2.x` line.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Use GitHub's private vulnerability reporting:
**Security → Report a vulnerability** on the
[repository](https://github.com/itsamziii/tagparse/security/advisories/new).
If you can't use that, email **mohd.amaan1583@gmail.com**.

Include:

- affected version(s)
- a minimal reproduction (template source + the data/options passed to `render`)
- impact (what an attacker gains)

You'll get an acknowledgement within a few days. Once a fix is ready it ships as
a patch release and the advisory is published with credit, unless you prefer to
stay anonymous.

## Security model

tagparse makes a deliberate trust split:

- **Template source is trusted.** The developer chooses what string gets
  `compile()`d. Compiling attacker-controlled template *source* is outside the
  default threat model — there is no cap on output size, so a hostile template
  using nested `{each}` can expand output until it exhausts memory. If you must
  compile untrusted templates, validate them first (see `walk` / `variableNames`
  / `tagNames`) and bound `maxDepth`.
- **Variable values and tag arguments are untrusted.** These are the user data
  that flows through a trusted template. The renderer never re-parses them, never
  evaluates code, and blocks prototype-pollution paths (`__proto__`,
  `constructor`, `prototype`) in `pathResolver`.

### Output sinks are your responsibility

The library emits plain strings; it does not sanitize for any sink.

- **Discord:** wrap untrusted text in `{escape:...}` / `escapeDiscord()`.
- **HTML/DOM:** escape with `escapeHtml()` before `innerHTML`, and never paste
  rendered output into a `javascript:`/URL context without a scheme allowlist.
