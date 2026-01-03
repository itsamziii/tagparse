# tagparse

A Unicode-aware, sync lexer and parser library for Node.js. Parse custom tag syntax like `{variable}` and `{function:arg1|arg2}` for templating engines, dashboards, and real-time applications.

## Features

- **Custom Tag Parsing**: Handles tags with complex argument structures
- **Sync API**: Fast, synchronous parsing (v2.0)
- **Position Tracking**: Error messages include line/column numbers
- **Strict Mode**: Optional syntax validation
- **Extensible**: Transformers and visitors for AST shaping
- **Sync Only**: Entire API is synchronous (parsing and evaluation)
- **Unicode Support**: Correctly handles emoji and multi-byte characters

## Installation

```bash
npm install tagparse
```

## Quick Start

```javascript
import { Parser, NodeType } from "tagparse";

const parser = new Parser();
const nodes = parser.parse("Hello {user}, your balance is {balance}!");

// Result:
// [
//   { type: "Text", value: "Hello " },
//   { type: "Variable", raw: "user" },
//   { type: "Text", value: ", your balance is " },
//   { type: "Variable", raw: "balance" },
//   { type: "Text", value: "!" }
// ]
```

> Note: The entire public API is synchronous, including tag evaluation. If you need async data fetching or IO during parsing, resolve data before calling `parse` or transform results afterward.

## Custom Tag Delimiters

```javascript
const parser = new Parser({
    lexerOptions: { tagStart: "{{", tagEnd: "}}" },
});

const nodes = parser.parse("Hello {{name}}!");
```

## Evaluating Tags

Use `evaluateTags` with custom parsers to resolve variables and functions:

```javascript
const data = { user: "Alice" };
const parser = new Parser({
    evaluateTags: true,
    variableParser: (name) => data[name] ?? "",
    functionParser: (name, args) => {
        if (name === "upper") return args[0].finalValue.toUpperCase();
        return "";
    },
});

const nodes = parser.parse("Hello {user}! {upper:hello}");
// Variables and functions are resolved with their values
```

## Async Evaluation

Use `ParserAsync` when your resolvers need to call APIs or databases:

```javascript
import { ParserAsync } from "tagparse";

const parser = new ParserAsync({
    evaluateTags: true,
    variableParser: async (name) => fetchUser(name), // returns a promise
    functionParser: async (name, args) => {
        if (name === "upper") return (args[0]?.finalValue ?? "").toUpperCase();
        return "";
    },
});

const nodes = await parser.parseAsync("Hello {user}! {upper:hello}");
```

If you skip `variableParser`/`functionParser`, async evaluation falls back to no-op resolvers so parsing still works.

## Rendering Safety Helpers

For templated output, escape values before sending to chat or HTML:

```javascript
import { escapeForDiscord, escapeHtml } from "tagparse";

const safeDiscord = escapeForDiscord(valueFromParser);
const safeHtml = escapeHtml(valueFromParser);
```

## Strict Mode

Enable strict mode for syntax validation:

```javascript
const parser = new Parser({ strict: true });

// These will throw StrictModeError:
parser.parse("{}"); // Empty tags not allowed
parser.parse("{spaced tag}"); // Spaces in tags not allowed
parser.parse("{unclosed"); // Unclosed tags not allowed
```

Errors include position information:

```javascript
try {
    parser.parse("{bad tag}");
} catch (error) {
    console.log(error.position); // { line: 1, column: 5, offset: 4 }
}
```

## AST Transformers

Transform the AST after parsing:

```javascript
import {
    Parser,
    transform,
    removeEmptyText,
    createVariableResolver,
} from "tagparse";

const parser = new Parser();
const nodes = parser.parse("Hello {name}!");

// Apply transformers
const resolved = transform(nodes, [
    createVariableResolver({ name: "World" }),
    removeEmptyText,
]);
```

Built-in transformers:

- `removeEmptyText` - Remove empty text nodes
- `removeWhitespaceText` - Remove whitespace-only text nodes
- `trimTextNodes` - Trim whitespace from text nodes
- `normalizeWhitespace` - Collapse multiple spaces
- `createVariableResolver(map)` - Resolve variables from a map

## AST Visitors

Walk the AST with the visitor pattern:

```javascript
import { Parser, walk, walkDeep, findNodes, NodeType } from "tagparse";

const parser = new Parser();
const nodes = parser.parse("{a} and {b:1|2}");

// Walk top-level nodes
walk(nodes, {
    visitVariable(node) {
        console.log("Variable:", node.raw);
    },
    visitFunction(node) {
        console.log("Function:", node.name);
    },
});

// Walk deeply (including function arguments)
walkDeep(nodes, {
    enter(node) {
        console.log("Entering:", node.type);
    },
    leave(node) {
        console.log("Leaving:", node.type);
    },
});

// Find specific nodes
const variables = findNodes(nodes, (n) => n.type === NodeType.Variable);
```

## API Reference

### Parser

```typescript
const parser = new Parser({
    strict?: boolean,           // Enable strict mode validation
    evaluateTags?: boolean,     // Enable tag evaluation
    functionParser?: (name: string, args: ArgumentNode[]) => unknown,
    variableParser?: (name: string) => unknown,
    lexerOptions?: {
        tagStart?: string,      // Default: "{"
        tagEnd?: string,        // Default: "}"
    },
});

const nodes: Node[] = parser.parse(input: string);
```

### ParserAsync

```typescript
const parser = new ParserAsync({
    strict?: boolean,
    evaluateTags?: boolean, // When true, parsers can return promises
    functionParser?: (name: string, args: ArgumentNode[]) => unknown | Promise<unknown>,
    variableParser?: (name: string) => unknown | Promise<unknown>,
    lexerOptions?: {
        tagStart?: string,
        tagEnd?: string,
    },
});

const nodes: Node[] = await parser.parseAsync(input: string);
```

### Lexer

```typescript
const lexer = new Lexer(input: string, options?: LexerOptions);

for (const token of lexer) {
    console.log(token.type, token.value, token.position);
}
```

### Node Types

```typescript
type Node = TextNode | VariableNode | FunctionNode;

interface TextNode {
    type: "Text";
    value: string;
}

interface VariableNode {
    type: "Variable";
    raw: string;
    value?: unknown; // Set when evaluateTags is true
}

interface FunctionNode {
    type: "Function";
    name: string;
    args: ArgumentNode[];
    value?: unknown; // Set when evaluateTags is true
}

interface ArgumentNode {
    type: "Argument";
    nodes: Node[];
    finalValue?: string;
}
```

### Errors

```typescript
import { TagParseError, StrictModeError } from "tagparse";

// Both include position information
interface Position {
    line: number; // 1-based
    column: number; // 1-based
    offset: number; // 0-based character offset
}
```

## License

MIT

## Acknowledgments

Inspired by [@aelxxs/ikigai](https://github.com/aelxxs/ikigai).
