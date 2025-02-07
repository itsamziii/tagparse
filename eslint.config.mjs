import { common, node, typescript, prettier } from "eslint-config-neon";

const config = [
    {
        ignores: ["dist", "node_modules", "*.{js,mjs}", "**.test.**"],
    },
    ...common,
    ...node,
    ...typescript,
    {
        languageOptions: {
            parserOptions: {
                project: "./tsconfig.json",
                warnOnUnsupportedTypeScriptVersion: false,
            },
        },
    },
    ...prettier,
];

export default config;
