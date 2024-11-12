import { common, node, typescript, prettier } from "eslint-config-neon";
/**
 * @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigArray}
 */
const config = [
    {
        ignores: ["dist", "node_modules", "*.js", "**.test.**"],
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
