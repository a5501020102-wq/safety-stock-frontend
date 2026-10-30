import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";
import globals from "globals";

// 純 HTML/CSS/JS 前端（web/）：禁止以 HTML 字串寫入 DOM，所有資料文字必須走 textContent / text node
const noHtmlInjection = ["innerHTML", "outerHTML", "insertAdjacentHTML"].map((property) => ({
  selector: `MemberExpression[property.name="${property}"]`,
  message: `禁止使用 ${property}：請改用 web/js/utils/dom.js 的 h() 建立元素，避免 XSS。`,
}));

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["web/**/*.js"],
    languageOptions: { globals: globals.browser },
    rules: {
      "no-restricted-syntax": ["error", ...noHtmlInjection],
      "no-restricted-globals": ["error", "event"],
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  prettier, // 必須放最後，關閉所有與 Prettier 衝突的 ESLint 規則
]);

export default eslintConfig;
