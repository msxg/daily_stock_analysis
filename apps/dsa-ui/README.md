# dsa-ui

`dsa-ui` is the new web UI workspace for Daily Stock Analysis.

## Stack

- React 19 + Vite 8 + TypeScript
- Tailwind CSS v4
- React Router + TanStack Query + Zustand
- lightweight-charts
- Vitest + Testing Library + Playwright + axe

## Local development

`apps/dsa-ui` 依赖 Node `22.13.0+`。进入目录后执行 `fnm use --install-if-missing --version-file-strategy=recursive`，会读取仓库根目录的 `.node-version` 并在缺失时自动安装。

```bash
cd apps/dsa-ui
eval "$(fnm env)"
fnm use --install-if-missing --version-file-strategy=recursive
npm install
npm run dev
```

## Test commands

```bash
cd apps/dsa-ui
eval "$(fnm env)"
fnm use --install-if-missing --version-file-strategy=recursive
npm run test
npm run test:e2e
npm run test:visual
npm run test:perf
```
