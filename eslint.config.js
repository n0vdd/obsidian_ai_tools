import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  // Global ignores
  {
    ignores: ["dist/", "node_modules/", "test/fixtures/"],
  },

  // Base JS recommended rules
  eslint.configs.recommended,

  // TypeScript strict + type-checked rules
  ...tseslint.configs.strictTypeChecked,

  // Parser options for type-aware linting
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "eslint.config.js",
            "vitest.config.ts",
            "test/*.ts",
          ],
          defaultProject: "tsconfig.json",
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // SonarJS recommended rules
  sonarjs.configs.recommended,

  // Source file overrides
  {
    files: ["src/**/*.ts"],
    rules: {
      // Used intentionally after Map.has() guards
      "@typescript-eslint/no-non-null-assertion": "off",
      // Enforce consistent type imports
      "@typescript-eslint/consistent-type-imports": "error",
      // .size is always number; template literals call .toString() natively
      "@typescript-eslint/restrict-template-expressions": "off",
      // Regexes process single lines, not unbounded user input
      "sonarjs/slow-regex": "off",
    },
  },

  // Test file overrides
  {
    files: ["test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "sonarjs/slow-regex": "off",
    },
  },

  // Disable type-checked rules for JS config files
  {
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },

  // Prettier compat — must be last to disable conflicting rules
  prettierConfig,
);
