import { defineConfig } from "tsdown";

const shared = {
    entry: ["src/index.ts", "src/discord.ts"],
    dts: { sourcemap: false },
    sourcemap: true,
    clean: true,
    treeshake: true,
    target: "es2022",
    platform: "neutral",
    hash: false,
    // esbuild (via tsup) stripped JSDoc from the bundle; rolldown keeps it by
    // default, which added ~2.5 kB gzip per entry. Keep `@__PURE__` and legal
    // comments so downstream treeshaking still works.
    outputOptions: {
        comments: { legal: true, annotation: true, jsdoc: false },
    },
} as const;

export default defineConfig([
    {
        ...shared,
        format: ["esm"],
        outDir: "dist/esm",
        outExtensions: () => ({ js: ".mjs", dts: ".d.mts" }),
    },
    {
        ...shared,
        format: ["cjs"],
        outDir: "dist/cjs",
        outExtensions: () => ({ js: ".cjs", dts: ".d.ts" }),
    },
]);
