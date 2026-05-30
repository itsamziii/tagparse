import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        coverage: {
            provider: "v8",
            include: ["src/**"],
            // Barrel files are pure re-exports — nothing meaningful to cover.
            exclude: ["src/index.ts", "src/discord.ts"],
            reporter: ["text", "text-summary", "html", "lcov"],
            thresholds: {
                statements: 75,
                branches: 70,
                functions: 60,
                lines: 75,
            },
        },
    },
});
