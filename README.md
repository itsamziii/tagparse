# tagparse

> A fast, AST-first templating library for Discord bots and chat applications. Parse `{variable}` and `{tag:arg|arg}` placeholder syntax with conditionals, loops, and built-in Discord-safe rendering.

[![npm](https://img.shields.io/npm/v/tagparse.svg)](https://www.npmjs.com/package/tagparse)
[![types](https://img.shields.io/badge/types-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

`tagparse` is a small (~10kB gzipped, zero deps), fully-typed templating engine designed for **bot message templates** — the kind of placeholder syntax users configure in Discord, Slack, and chat-bot dashboards. It parses templates into an AST, gives you a friendly `Template.compile().render()` API, and ships with batteries-included Discord helpers for mentions, embeds, timestamps, and markdown-safe output.

## Why use tagparse?

- **Tiny and fast.** Linear-time parser, no dependencies, ESM + CJS. Parses 500KB templates in ~200ms.
- **Compile-once, render-many.** Parse a template once, render against different data thousands of times per second. Half a million renders/sec on a laptop.
- **Conditionals and loops built in.** `{if:cond|then|else}`, `{each:items|template}`, `{eq}`, `{unless}`, `{not}`, `{default}` — no plugins required.
- **Discord-safe by default.** First-class helpers for `<@user>`, `<#channel>`, `<:emoji:>`, `<t:timestamp:R>`, plus markdown and mention escaping that survives `@everyone` injection attempts.
- **Custom tag handlers.** Register your own tags as plain functions. Structural tags get raw AST access for lazy evaluation.
- **Async resolvers.** Fetch user data from a DB or API mid-render with `renderAsync()`.
- **Real diagnostics.** Errors with line/column spans and hints, not generic exceptions.
- **Strict TypeScript.** Every public type is exported; no `any` in the public API.

## Comparison

| Feature                       | tagparse | Mustache | Handlebars | EJS |
| ----------------------------- | :------: | :------: | :--------: | :-: |
| Discord-style `{tag:arg}`     |    ✅    |    ❌    |     ❌     | ❌  |
| Built-in mention escaping     |    ✅    |    ❌    |     ❌     | ❌  |
| Custom delimiters             |    ✅    |    ✅    |     ❌     | ❌  |
| AST inspection / visitors     |    ✅    |    ❌    |     ✅     | ❌  |
| Async resolvers               |    ✅    |    ❌    |     ❌     | ✅  |
| Zero dependencies             |    ✅    |    ✅    |     ❌     | ❌  |
| TypeScript-native             |    ✅    |   ⚠️    |     ⚠️     | ⚠️  |

## Install

```bash
npm install tagparse
```

Requires Node 18+. Pure ES2022. ESM and CommonJS both supported.

## Quick start

```ts
import { Template, builtinTags } from "tagparse";
import { discordTags } from "tagparse/discord";

const tpl = Template.compile(
    "Welcome {mention:{userId}}! You have {if:{premium}|⭐ premium access|a basic plan}.",
);

const message = tpl.render({
    variables: {
        userId: "123456789012345678",
        premium: "true",
    },
    tags: { ...builtinTags, ...discordTags },
});

// → "Welcome <@123456789012345678>! You have ⭐ premium access."
```

## Nested data

For dotted paths like `{member.proper}` or `{guild.id}`, use `pathResolver`:

```ts
import { Template, pathResolver } from "tagparse";

const tpl = Template.compile("Hi {member.proper}, you're in {guild.name}!");

tpl.render({
    variables: pathResolver({
        member: { proper: "Alice#1234" },
        guild:  { name: "My Server" },
    }),
});
// → "Hi Alice#1234, you're in My Server!"
```

`pathResolver` walks the data object segment by segment. Array indexing works too (`{items.0.name}`). Zero-arg functions are auto-invoked, so lazy values like `{ user: () => fetchUser() }` are supported. Prototype-pollution paths (`__proto__`, `constructor`, `prototype`) are refused.

## Syntax

| Form                       | Meaning                                               |
| -------------------------- | ----------------------------------------------------- |
| `{name}`                   | Variable substitution                                 |
| `{tag:arg}`                | Tag with one argument                                 |
| `{tag:arg1\|arg2\|arg3}`   | Tag with multiple pipe-separated arguments            |
| `{outer:{inner}}`          | Nested tags — inner evaluates first                   |
| `\{` `\}` `\|` `\\`        | Escape a delimiter (write a literal `{`, `}`, etc.)   |

## Built-in tags

```ts
import { Template, builtinTags } from "tagparse";

Template.compile("{if:{age}|adult|minor}").render({ /* ... */ });
Template.compile("{unless:{banned}|welcome|access denied}");
Template.compile("{each:apple,banana,cherry|<{it}>|, }");
Template.compile("{eq:{role}|admin}");
Template.compile("{ne:{a}|{b}}");
Template.compile("{gt:{score}|100}");
Template.compile("{lt:{score}|10}");
Template.compile("{not:{flag}}");
Template.compile("{upper:{name}}");
Template.compile("{lower:{name}}");
Template.compile("{trim:{input}}");
Template.compile("{length:{name}}");
Template.compile("{replace:{text}|old|new}");
Template.compile("{default:{nickname}|stranger}");
```

### `{each}` locals

Inside an `{each}` template, these locals are available:

- `{it}` — the current item
- `{idx}` — 0-based index
- `{idx1}` — 1-based index
- `{first}` / `{last}` — booleans

```ts
Template.compile("{each:a,b,c|{idx1}. {it}{if:{last}||\\n}}");
// 1. a
// 2. b
// 3. c
```

## Discord helpers

Import from the dedicated `tagparse/discord` subpath to keep the core small.

```ts
import { Template, builtinTags } from "tagparse";
import { discordTags, escapeDiscord } from "tagparse/discord";

const tpl = Template.compile(
    "Hi {mention:{userId}}, your role is {role:{roleId}}, " +
    "scheduled at {timestamp:{when}|R}. " +
    "Note: {escape:{userInput}}",
);

tpl.render({
    variables: {
        userId: "123456789012345678",
        roleId: "987654321098765432",
        when: "1700000000",
        userInput: "**@everyone — fake announcement**",
    },
    tags: { ...builtinTags, ...discordTags },
});
```

The `{escape:...}` tag neutralizes markdown chars (`* _ ~ \``) **and** mention syntax (`@everyone`, `<@id>`, `<@&id>`, `<#id>`) by inserting zero-width spaces. Use it on every piece of user-controlled text spliced into a template.

| Tag                                  | Output                  |
| ------------------------------------ | ----------------------- |
| `{mention:id}`                       | `<@id>`                 |
| `{channel:id}`                       | `<#id>`                 |
| `{role:id}`                          | `<@&id>`                |
| `{emoji:name\|id}`                   | `<:name:id>`            |
| `{animEmoji:name\|id}`               | `<a:name:id>`           |
| `{timestamp:unix\|style}`            | `<t:unix:style>`        |
| `{bold:text}` / `{italic:text}`      | `**text**` / `*text*`   |
| `{underline:text}` / `{strike:text}` | `__text__` / `~~text~~` |
| `{code:text}` / `{spoiler:text}`     | `` `text` `` / `\|\|text\|\|` |
| `{codeblock:lang\|text}`             | Fenced code block       |
| `{escape:text}`                      | Markdown- and mention-safe |

## Custom tags

Plain functions are tags:

```ts
const tpl = Template.compile("Total: {sum:{a}|{b}|{c}}");
tpl.render({
    variables: { a: "10", b: "20", c: "30" },
    tags: {
        sum: (args) => args.reduce((acc, v) => acc + Number(v), 0),
    },
});
// → "Total: 60"
```

For tags that conditionally evaluate args (like `{if}`), use `defineStructuralTag`:

```ts
import { defineStructuralTag } from "tagparse";

const switchTag = defineStructuralTag((args, ctx, render) => {
    const value = render(args[0]);
    for (let i = 1; i < args.length - 1; i += 2) {
        if (render(args[i]) === value) return render(args[i + 1]);
    }
    return args.length % 2 === 0 ? render(args[args.length - 1]) : "";
});

Template.compile("{switch:{role}|admin|🛡|mod|🔧|user|👤|❓}").render({ /* ... */ });
```

## Async data

```ts
import { Template, builtinTags } from "tagparse";

const tpl = Template.compile("Hi {profile:{userId}}!");

await tpl.renderAsync({
    variables: { userId: "123" },
    tags: {
        ...builtinTags,
        profile: async ([id]) => {
            const user = await db.users.findOne({ id });
            return user.displayName;
        },
    },
});
```

## Diagnostics

`Template.compile()` collects errors and warnings instead of throwing on every issue. This keeps user-authored templates from blowing up bots in production.

```ts
const tpl = Template.compile("Hello {unclosed");
console.log(tpl.diagnostics);
// [{ severity: "error", message: "Unclosed tag", span: { start: { line: 1, column: 7, ... }, ... } }]

console.log(tpl.hasErrors); // true
```

For strict parsing (throw on first error), pass `{ strict: true }` to `compile`.

## Custom delimiters

```ts
const tpl = Template.compile("Hi <%= name %>!", {
    tagStart: "<%=",
    tagEnd: "%>",
});
```

## AST inspection

Pre-flight validate templates against a schema:

```ts
const tpl = Template.compile(userProvidedTemplate);

// Reject templates referencing variables you don't expose
const allowed = new Set(["user", "channel", "balance"]);
const used = tpl.variableNames;
const unknown = [...used].filter((v) => !allowed.has(v));
if (unknown.length) throw new Error(`Unknown variables: ${unknown.join(", ")}`);
```

## API surface

```ts
import {
    // Main facade
    Template,

    // Core functions
    parse,        // (input, options) => { template, diagnostics }
    render,       // (template, options) => string
    renderAsync,  // (template, options) => Promise<string>

    // Tags
    builtinTags,
    defineStructuralTag,

    // Resolvers
    pathResolver,

    // AST utilities
    walk, findNodes, collectVariableNames, collectTagNames,

    // Errors
    TagParseError, StrictModeError, RenderError, AggregateParseError,

    // Lower-level
    Lexer, Stream,
} from "tagparse";

import {
    discordTags,
    escapeDiscord,
    truncate,
    DISCORD_LIMITS,
} from "tagparse/discord";
```

## Performance

| Input size  | Parse time | Render time |
| ----------- | ---------: | ----------: |
| 1 KB        |    < 1 ms  |    < 1 ms   |
| 10 KB       |     ~3 ms  |    < 1 ms   |
| 100 KB      |    ~25 ms  |     ~5 ms   |
| 500 KB      |   ~150 ms  |    ~50 ms   |

Compile-once / render-many: **~500,000 renders/sec** on a typical Discord bot template.

## Migrating from v1

v2 is a complete rewrite. The Parser class is gone; use `Template.compile()` or `parse()`. The `evaluateTags` mode is replaced by registering tag handlers in `render()`. See the [CHANGELOG](./CHANGELOG.md) for the full list of changes.

## Inspired by

[ikigai](https://github.com/aelxxs/ikigai) — the original Discord-bot tag parser this library descends from.

## License

MIT
