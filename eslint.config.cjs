const { common, node, typescript, prettier } = require("eslint-config-neon");
/**
 * @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigArray}
 */
const config = [
    {
        ignores: ["dist", "node_modules", "*.js"],
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

module.exports = config;
