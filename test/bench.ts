import { Template } from "../src/lib/compiler/Template.js";
import { builtinTags } from "../src/lib/tags/builtins.js";

console.log("─── Lexer/parser scaling (was O(n²) in v1) ───");
for (const size of [1_000, 10_000, 50_000, 100_000, 500_000]) {
    const block =
        "Hello {user}, balance: {balance}. Tier: {if:{premium}|gold|free}. ";
    const input = block.repeat(Math.ceil(size / block.length)).slice(0, size);
    const t0 = performance.now();
    const tpl = Template.compile(input);
    const t1 = performance.now();
    const out = tpl.render({
        variables: { user: "Alice", balance: "100", premium: "true" },
        tags: builtinTags,
    });
    const t2 = performance.now();
    console.log(
        `size=${size.toString().padStart(7)}  parse=${(t1 - t0).toFixed(1).padStart(7)}ms  render=${(t2 - t1).toFixed(1).padStart(7)}ms  out_len=${out.length}`,
    );
}

console.log("\n─── Compile-once render-many ───");
const tpl = Template.compile("{if:{premium}|⭐ {upper:{user}}|{user}}");
const N = 100_000;
const t0 = performance.now();
for (let i = 0; i < N; i++) {
    tpl.render({
        variables: { user: "Alice", premium: i % 2 === 0 ? "true" : "" },
        tags: builtinTags,
    });
}
const elapsed = performance.now() - t0;
console.log(
    `${N.toLocaleString()} renders in ${elapsed.toFixed(0)}ms = ${((N / elapsed) * 1000).toFixed(0)} renders/sec`,
);
