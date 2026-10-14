import js from "@eslint/js";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      sonarjs,
    },
    rules: {
      ...sonarjs.configs.recommended.rules,
      "sonarjs/cognitive-complexity": ["warn", 15],
      "sonarjs/no-duplicate-string": ["warn", { "threshold": 5 }],
      "sonarjs/no-identical-functions": "warn",
      "sonarjs/publicly-writable-directories": "off",
      "sonarjs/unused-import": "warn",
      "sonarjs/no-dead-store": "off",
      "sonarjs/no-unused-vars": "off",
      "sonarjs/pseudo-random": "off",
      "sonarjs/todo-tag": "warn",
      "sonarjs/slow-regex": "warn",
      "sonarjs/no-nested-conditional": "warn",
      "sonarjs/no-nested-template-literals": "warn",
      "no-empty": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    ignores: ["dist/", "coverage/", "node_modules/", "graphify-out/"],
  }
);