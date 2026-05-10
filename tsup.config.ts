import { defineConfig } from "tsup";

export default defineConfig([
    {
        entry: ["src/index.ts", "src/discord.ts"],
        format: ["esm"],
        outDir: "dist/esm",
        outExtension: () => ({ js: ".mjs", dts: ".d.mts" }),
        dts: true,
        sourcemap: true,
        clean: true,
        treeshake: true,
        target: "es2022",
    },
    {
        entry: ["src/index.ts", "src/discord.ts"],
        format: ["cjs"],
        outDir: "dist/cjs",
        outExtension: () => ({ js: ".cjs", dts: ".d.ts" }),
        dts: true,
        sourcemap: true,
        clean: false,
        treeshake: true,
        target: "es2022",
    },
]);
