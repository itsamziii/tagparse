import { relative, resolve } from "node:path";
import process from "node:process";
import { defineConfig, type Options } from "tsup";

const baseOptions: Options = {
    dts: true,
    shims: true,
    skipNodeModulesBundle: true,
    clean: true,
    sourcemap: true,
    entry: ["./src/index.ts"],
    target: "es2020",
    minify: false,
    tsconfig: relative(__dirname, resolve(process.cwd(), "tsconfig.json")),
    keepNames: true,
};

export default [
    defineConfig({
        ...baseOptions,
        format: "esm",
        outDir: "dist/esm",
    }),
    defineConfig({
        ...baseOptions,
        format: "cjs",
        outDir: "dist/cjs",
        outExtension: () => ({ js: ".cjs" }),
    }),
];
