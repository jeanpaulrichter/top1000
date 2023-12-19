/* eslint-env node */
module.exports = {
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
    ],
    parser: '@typescript-eslint/parser',
    plugins: ["@typescript-eslint"],
    root: true,
    parserOptions: {
        sourceType: "module"
    },
    ignorePatterns: ["debug/**/*", "dist/**/*", "node_modules/**/*"]
};