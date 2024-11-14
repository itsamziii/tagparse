import { defineConfig } from "tsup";

export default defineConfig({
    format: ["esm"],
    dts: true,
    shims: true,
    skipNodeModulesBundle: true,
    clean: true,
    sourcemap: true,
    entry: ["./src/index.ts"],
});
