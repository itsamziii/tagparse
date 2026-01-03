import { Parser, walk, transform, createVariableResolver } from "tagparse";

// Basic parsing
const parser = new Parser();
const nodes = parser.parse("Hello {user}, your balance is {balance}!");

console.log("Parsed nodes:");
console.dir(nodes, { depth: null });

// With evaluation
const evaluatingParser = new Parser({
    evaluateTags: true,
    variableParser: (name) => `[${name.toUpperCase()}]`,
    functionParser: (name, args) => `${name}(${args.map(a => a.finalValue).join(", ")})`,
});

const evaluated = evaluatingParser.parse("Hello {user}! Result: {calc:1|2|3}");
console.log("\nEvaluated nodes:");
console.dir(evaluated, { depth: null });

// Using transformers
const data = { user: "Alice", balance: "$100" };
const resolved = transform(nodes, [
    createVariableResolver(data),
]);

console.log("\nTransformed nodes:");
console.dir(resolved, { depth: null });

// Using visitors
console.log("\nWalking nodes:");
walk(nodes, {
    visitText(node) {
        console.log("  Text:", JSON.stringify(node.value));
    },
    visitVariable(node) {
        console.log("  Variable:", node.raw);
    },
});
