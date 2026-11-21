import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    prettier,
    {
        ignores: ["dist/", "node_modules/"],
    },
    {
        rules: {
            // Vencord/Discord API code uses 'any' extensively and intentionally
            "@typescript-eslint/no-explicit-any": "off",

            // Unused vars are common in evolving codebases — warn instead of error
            "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],

            // Allow empty catch blocks (error intentionally swallowed)
            "no-empty": ["error", { allowEmptyCatch: true }],

            // Vencord plugins use require() for dynamic imports
            "@typescript-eslint/no-require-imports": "off",

            // Allow reassigning caught errors (intentional error enrichment)
            "no-ex-assign": "off",

            // let vs const is a style preference, not critical
            "prefer-const": "off",

            // Error cause chaining is not required for this project
            "preserve-caught-error": "off",
        },
    }
);
