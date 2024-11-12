# tagparse

A way to parse tags.

## Table of Contents

-   [Installation](#installation)
-   [Usage](#usage)
-   [API](#api)
-   [Development](#development)
-   [License](#license)

## Installation

To install the dependencies, run:

```sh
npm install
```

## Usage

Here's an example of how to use the `Parser` class:

```sh
import { Parser } from "./dist/index.js";

(async () => {
    const parser = new Parser("{hey:{heyyy}|test is this {cool.test}}");
    const result = await parser.parse();
    console.dir(result, { depth: null });
})();
```

## API

### `Parser`

#### `constructor(input: string, options: ParserOptions)`

Creates a new `Parser` instance.

-   `input` (string): The input string to parse.
-   `options` (ParserOptions): The parser options.

#### `parse(): Promise<Node[]>`

Parses the input string and returns an array of nodes.

### `Lexer`

#### `constructor(input: string, options: LexerOptions)`

Creates a new `Lexer` instance.

-   `input` (string): The input string to tokenize.
-   `options` (LexerOptions): The lexer options.

#### `[Symbol.asyncIterator](): TokenGenerator`

Returns an async iterator that yields tokens.

## Development

To build the project, run:

```sh
npm run build
```

To run the example:

```sh
node example.js
```

## License

This project is licensed under the MIT License.
