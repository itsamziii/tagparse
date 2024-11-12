# 🏷️ tagparse

**tagparse** is a high-performance, stream-based lexer and parser library for Node.js, designed to handle asynchronous, memory-efficient parsing of custom tag-based syntax. It’s ideal for high-concurrency applications and real-time data processing where non-blocking, scalable parsing is essential.

> **Use Case:** Quickly parse and process custom tags (e.g., `{variable}`, `{function:arg1|arg2}`) for templating engines, dashboards, and real-time applications.

---

## ✨ Features

-   **Custom Tag Parsing**: Handles tags with complex argument structures (e.g., `{var}`, `{func:arg1|arg2}`).
-   **Stream-Based, Asynchronous Design**: Perfect for processing large datasets with minimal memory usage, supporting real-time and high-concurrency environments.
-   **Strict Mode for Syntax Validation**: Ensures robust syntax adherence with optional strict validation.
-   **Flexible & Extensible**: Customize tokens, tag formats, and parsing logic as needed.
-   **Ideal for Real-Time Applications**: Powers templating engines, dynamic dashboards, and high-performance real-time data processing.

---

## 📦 Installation

Install via npm:

```bash
npm install tagparse
```

---

## 🚀 Usage

`tagparse` is particularly useful for custom syntax processing in templating engines, real-time chat systems, or data stream processing applications.

### 🛠️ Basic Example

```javascript
import { Lexer, Parser, NodeType } from "tagparse";

const inputText = "Hello {user}, your balance is {balance}!";

// Step 1: Initialize the Parser
const parser = new Parser(inputText, {
    lexerOptions: { tagStart: "{{", tagEnd: "}}" },
    parseTags: true,
    strict: true,
});

// Step 2: Parse the text
(async () => {
    const nodes = await parser.parse();
    console.log(nodes); // Parsed tokens and nodes
})();
```

### 🔧 Customizing Tags and Syntax

Easily define custom tag formats, enable strict mode for syntax validation, and configure tag handling:

```javascript
const parser = new Parser("Hello {{user}}", {
    lexerOptions: { tagStart: "{{", tagEnd: "}}" },
    parseTags: true,
    strict: true,
});
```

### 📄 Example Use Case: Template Processing

This example demonstrates how to use the parser to replace placeholders dynamically within a template:

```javascript
(async () => {
    const values = {
        name: "John",
        orderId: "12345",
    };

    const parser = new Parser(inputText);
    const nodes = await parser.parse();

    // Implement an on-the-go interpreter via `variableParser` & `functionParser`
    const result = nodes
        .map((node) => {
            if (node.type === NodeType.Variable && node.raw in values) {
                return values[node.raw];
            }
            return node.value;
        })
        .join("");

    console.log(result); // Outputs: "Hello, John! Your order #12345 is confirmed."
})();
```

---

## 📚 API Reference

### Lexer

The `Lexer` class tokenizes a given input string, identifying tags, literals, and other specified tokens.

-   **Constructor**: `new Lexer(input: string, options: LexerOptions)`
    -   **input**: The string to tokenize.
    -   **options**: Configuration options, like `tagStart` and `tagEnd`.

### Parser

The `Parser` class consumes tokens from the lexer and constructs a structured representation of the text (AST).

-   **Constructor**: `new Parser(input: string, options: ParserOptions)`

    -   **input**: The input text.
    -   **options**: Configuration options, including:
        -   **parseTags**: Enable/disable tag parsing.
        -   **strict**: Enable strict mode for syntax validation.
        -   **functionParser** and **variableParser**: Optional handlers for custom tag logic.

-   **Methods**:
    -   `parse()`: Asynchronously parses the input and returns an array of nodes.

---

## 🤝 Contributing

Contributions are welcomed! If you find a bug or want to suggest an improvement, feel free to open an issue or submit a pull request.

---

## 📄 License

This library is licensed under the MIT License. See [LICENSE](LICENSE) for more information.

---

## 🙏 Acknowledgments

Special thanks to [@aelxxs/ikigai](https://github.com/aelxxs/ikigai) for inspiration.
