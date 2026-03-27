# DSA Docs

`apps/dsa-docs` 是基于 Docusaurus 的文档站点工程，用于承载 `dsa-ui` 的重构文档和操作手册。

项目依赖 Node `22.13.0+`。进入目录后执行 `fnm use --install-if-missing --version-file-strategy=recursive`，会读取仓库根目录的 `.node-version` 并在缺失时自动安装。

## 安装

```bash
cd apps/dsa-docs
eval "$(fnm env)"
fnm use --install-if-missing --version-file-strategy=recursive
npm install
```

## 本地开发

```bash
cd apps/dsa-docs
eval "$(fnm env)"
fnm use --install-if-missing --version-file-strategy=recursive
npm run start
```

## 构建

```bash
cd apps/dsa-docs
eval "$(fnm env)"
fnm use --install-if-missing --version-file-strategy=recursive
npm run build
```

## 端到端与截图校验

```bash
cd apps/dsa-docs
eval "$(fnm env)"
fnm use --install-if-missing --version-file-strategy=recursive
npm run test:e2e:update
npm run test:e2e
npm run test:visual
```

说明：

- `test:e2e:update` 会生成/更新 Playwright 视觉基线截图。
- `test:e2e` 执行功能级端到端验证。
- `test:visual` 只执行带 `@visual` 标记的 UI 截图回归用例。
