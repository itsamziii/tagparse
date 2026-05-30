# tagparse

## 2.0.1

### Patch Changes

- 3614599: Fix `{each}` over array variables, and harden the Discord `codeblock` fence escape.

  - `{each:{items}|...}` now iterates real array values. Arrays reach the tag JSON-encoded by the renderer and are parsed back into items, so an array like `["a","b","c"]` renders as three items instead of the literal JSON string. Comma-separated string lists behave as before.
  - `codeblock` now neutralizes any run of three or more backticks. Previously six or more backticks could re-form a valid code fence, letting attacker-controlled text break out of the block.

## 2.0.0

### Major Changes

Complete rewrite. The entire API is new and incompatible with v1.

**Parser / AST**

- New Lexer → Parser → AST pipeline. Templates compile to an immutable node tree (`TextNode | VariableNode | TagNode`) with source spans for error reporting.
- `parse(source, options?)` returns `{ template, diagnostics }`. Diagnostics carry severity, message, span, and an optional hint.
- Strict mode (`{ strict: true }`) throws `AggregateParseError` on any parse error instead of silently degrading.
- Configurable delimiters (`tagStart`, `tagEnd`, `escapeChar`) and max nesting depth.
- O(n) lexer — previous implementation was O(n²).

**Rendering**

- `render(template, options)` — synchronous renderer.
- `renderAsync(template, options)` — async renderer; resolvers and tag handlers may return `Promise`.
- `Template` class facade: `Template.compile(source)` → `.render(options)` / `.renderAsync(options)`. Compile once, render many times.
- `variables` option accepts a resolver function or a plain record. Record values that are zero-arg functions are auto-invoked.
- `pathResolver(data)` — resolves dotted paths (`{member.name}`, `{items.0.value}`). Blocks prototype-pollution keys (`__proto__`, `constructor`, `prototype`).
- `onMissingVariable` and `onMissingTag` hooks for custom fallback behavior.

**Structural tags**

Tags whose arguments should not always be evaluated (e.g. `{if}`, `{each}`) are now `StructuralTagHandler`. The handler receives raw `ArgumentNode[]` and a `render` callback to evaluate any subset on demand. Works in both sync and async renderers.

**Built-in tags**

`if`, `unless`, `each`, `eq`, `ne`, `gt`, `lt`, `gte`, `lte`, `not`, `upper`, `lower`, `trim`, `length`, `replace`, `default`.

`{each:list|template|sep?}` iterates a comma-separated list with locals `{it}`, `{idx}`, `{idx1}`, `{first}`, `{last}`.

**Discord subpackage** (`tagparse/discord`)

Escape helpers: `escapeDiscordMarkdown`, `escapeDiscordMentions`, `escapeDiscord`, `escapeDiscordPreservingCode`, `escapeHtml`.

Discord tags: `mention`, `channel`, `role`, `emoji`, `animEmoji`, `timestamp`, `escape`, `bold`, `italic`, `underline`, `strike`, `code`, `spoiler`, `codeblock`.

Utilities: `truncate(input, max)` (code-point-aware), `DISCORD_LIMITS` constants.

**Visitor API**

`walk(nodes, visitor)` — depth-first traversal with `enter` / `leave` hooks and `"skip"` / `"stop"` signals.
`findNodes`, `collectVariableNames`, `collectTagNames` — convenience helpers built on `walk`.

**Error types**

`TagParseError` (base), `StrictModeError`, `MaxDepthError`, `RenderError`, `AggregateParseError`.

**Output**

Dual ESM (`dist/esm`) and CJS (`dist/cjs`) with full `.d.ts` declarations. Exports map includes `tagparse` and `tagparse/discord`.

## 0.1.0

### Minor Changes

- a76b08b: Remove support for CJS

## 0.0.2

### Patch Changes

- 366dfe0: update lint script
- 356e149: minor repo changes
- 3033099: init commit
