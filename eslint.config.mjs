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
  {
    // eslint-config-next が有効にするのは typescript-eslint の recommended 相当で、
    // no-explicit-any は入るが no-non-null-assertion は入らない（strict 側のルール）。
    // noUncheckedIndexedAccess を tsconfig で有効にしたので、
    // 添字アクセスの undefined を `!` で黙らせられると意味がなくなる。明示的に禁止する。
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
  {
    // テストは事前に投入したデータを取り出す都合で添字アクセスが多く、
    // そこで `!` を使うのは実害がない。禁止せず、気づける程度に警告だけ出す。
    files: ["tests/**/*.ts", "src/**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "warn",
    },
  },
]);

export default eslintConfig;
