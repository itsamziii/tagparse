import { defineConfig } from "tsup";

export default defineConfig({
    format: ["cjs", "esm"],
    dts: true,
    shims: true,
    skipNodeModulesBundle: true,
    clean: true,
    entry: ["./src/index.ts"],
});
