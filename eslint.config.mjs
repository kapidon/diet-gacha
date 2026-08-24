import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma の生成物。手で書かないので検査しない。
    "src/generated/**",
    // Claude Code が作る worktree の複製。本体を二重に検査してしまう。
    ".claude/**",
  ]),
]);

export default eslintConfig;
