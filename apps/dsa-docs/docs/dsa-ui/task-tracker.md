---
title: DSA UI 任务跟踪
sidebar_position: 4
---

# DSA UI 任务跟踪

## 1. 用途

本文件用于 `apps/dsa-ui` 的断点续做与交接，确保任务中断后可快速恢复。

配套文档：

- [DSA UI 重构方案](./redesign-proposal)
- [DSA UI 开发计划](./development-plan)

---

## 2. 状态定义

- `pending`：未开始
- `in_progress`：进行中
- `blocked`：阻塞
- `done`：已完成并通过阶段门禁

---

## 3. 当前状态

| 项目 | 内容 |
| --- | --- |
| 当前阶段 | Phase 6 |
| 当前任务 | `UI-604` 全量回归与验收清单 |
| 总体状态 | `done` |
| 最近完成 | `UI-204`~`UI-604` 全部完成（问股/持仓/回测/设置登录/切换收尾） |
| 当前阻塞 | 无 |
| 下一步 | 如需接管旧 UI：`cd apps/dsa-ui && eval "$(fnm env)" && npm run build:static` |

---

## 4. 阶段进度

| Phase | 名称 | 状态 | 说明 |
| --- | --- | --- | --- |
| Phase 0 | 工程基线 | `done` | 工程壳层、API/类型层、测试基线完成 |
| Phase 1 | 分析台 | `done` | 分析流、历史管理、报告 Tabs、移动双视图完成 |
| Phase 2 | 问股 | `done` | Markdown/思考折叠、SSE、上下文注入、移动交互完成 |
| Phase 3 | 持仓 | `done` | 总览/录入/导入/流水工作区与禁写保护完成 |
| Phase 4 | 回测 | `done` | 过滤控制、KPI、趋势图、结果表、分页完成 |
| Phase 5 | 设置与登录 | `done` | 分类编辑、认证、导入导出、登录/首次设置完成 |
| Phase 6 | 切换与收尾 | `done` | 输出切换脚本、回滚策略、全量回归、文档同步完成 |

---

## 5. 任务清单

| 任务 ID | 阶段 | 任务 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| UI-001~UI-009 | Phase 0 | 工程初始化、壳层、API/类型基线、测试基线 | `done` | `apps/dsa-ui` 独立工程已稳定运行 |
| UI-101~UI-107 | Phase 1 | 分析台重构 | `done` | 分析提交、任务流、历史、报告 tabs、追问联动完成 |
| UI-201~UI-203 | Phase 2 | 问股会话管理、会话头部、输入区 | `done` | 会话切换/新建/删除、导出发送、策略选择完成 |
| UI-204 | Phase 2 | 消息流渲染（Markdown + 思考过程折叠） | `done` | `react-markdown + remark-gfm` 已接入 |
| UI-205 | Phase 2 | SSE/流式状态反馈 | `done` | `chatStream`、事件时间线、取消请求完成 |
| UI-206 | Phase 2 | 分析台追问上下文注入 | `done` | `recordId` 注入 + 状态提示 + 消费标记完成 |
| UI-207 | Phase 2 | 移动端问股交互 | `done` | 会话/消息双面板与移动交互完成 |
| UI-301~UI-309 | Phase 3 | 持仓工作区重构 | `done` | 账户/总览/风险/录入/导入/流水与禁写保护完成 |
| UI-401~UI-406 | Phase 4 | 回测工作区重构 | `done` | KPI、图表、结果表、运行回测、移动布局完成 |
| UI-501~UI-508 | Phase 5 | 设置与登录重构 | `done` | 分类编辑、认证、env 导入导出、登录流程完成 |
| UI-601 | Phase 6 | 构建输出切换 | `done` | 默认输出 `static-ui-preview/`，支持 `build:static` |
| UI-602 | Phase 6 | 脚本/文档同步 | `done` | 计划、跟踪、变更日志已同步 |
| UI-603 | Phase 6 | 回滚方案 | `done` | `build:preview` 回滚路径已固化 |
| UI-604 | Phase 6 | 全量回归与验收 | `done` | 单测/集成/浏览器/联调/构建全通过 |

---

## 6. 关键实现文件（本轮）

- `apps/dsa-ui/src/features/chat/pages/ChatPage.tsx`
- `apps/dsa-ui/src/features/portfolio/pages/PortfolioPage.tsx`
- `apps/dsa-ui/src/features/backtest/pages/BacktestPage.tsx`
- `apps/dsa-ui/src/features/settings/pages/SettingsPage.tsx`
- `apps/dsa-ui/src/features/auth/pages/LoginPage.tsx`
- `apps/dsa-ui/src/shared/api/agent.ts`
- `apps/dsa-ui/e2e/workbench.spec.ts`
- `apps/dsa-ui/tests/integration/chat-session.integration.test.tsx`
- `apps/dsa-ui/tests/integration/login.integration.test.tsx`
- `apps/dsa-ui/vite.config.ts`

---

## 7. 测试记录

| 日期 | 阶段/任务 | 命令 | 结果 | 备注 |
| --- | --- | --- | --- | --- |
| 2026-03-27 | Phase 2~5 回归 | `eval "$(fnm env)" && npm run lint` | ✅ | 通过 |
| 2026-03-27 | Phase 2~5 回归 | `eval "$(fnm env)" && npm run test:unit` | ✅ | 20/20 通过 |
| 2026-03-27 | Phase 2~5 回归 | `eval "$(fnm env)" && npm run test:integration` | ✅ | 17/17 通过 |
| 2026-03-27 | Phase 2~5 回归 | `eval "$(fnm env)" && npm run test:e2e` | ✅ | 7 passed, 2 skipped |
| 2026-03-27 | Phase 2~5 回归 | `eval "$(fnm env)" && npm run test:visual` | ✅ | 6/6 通过 |
| 2026-03-27 | Phase 2~5 回归 | `eval "$(fnm env)" && npm run test:perf` | ✅ | 1/1 通过 |
| 2026-03-27 | 后端联调 | `eval "$(fnm env)" && npm run test:e2e:backend` | ✅ | 2/2 通过（真后端） |
| 2026-03-27 | 构建验证 | `eval "$(fnm env)" && npm run build` | ✅ | 输出 `static-ui-preview/` |
| 2026-03-27 | 稳定性说明 | `npm run test:visual` 与 `npm run test:perf` 并发执行 | ⚠️ | 会出现 `ERR_CONNECTION_REFUSED` 假失败，已确认串行执行可稳定通过 |

---

## 8. 中断恢复指引

恢复时执行顺序：

1. 打开本文件确认 `当前状态` 与 `下一步`。
2. 进入项目目录：`cd apps/dsa-ui`。
3. 执行 Node 环境初始化：`eval "$(fnm env)"`。
4. 若继续开发，先跑 `npm run test:integration`。
5. 若准备验收，串行执行：
   - `npm run test:e2e`
   - `npm run test:visual`
   - `npm run test:perf`
   - `npm run test:e2e:backend`
6. 最后执行 `npm run build`。

---

## 9. 交接记录（2026-03-27）

已完成事项：

- 完成 Phase 2 `UI-204`~`UI-207`（问股消息 Markdown、思考折叠、SSE、上下文注入、移动交互）。
- 完成 Phase 3 持仓工作区重构（总览、风险、录入、导入、流水、禁写保护）。
- 完成 Phase 4 回测工作区重构（筛选、运行、KPI、趋势图、结果表、分页）。
- 完成 Phase 5 设置与登录重构（分类编辑、认证、导入导出、登录/首次设置）。
- 完成 Phase 6 输出切换与回滚机制（`build`/`build:preview`/`build:static`）。
- 完成全量质量门禁（单元、集成、浏览器、后端联调、构建）。

下一步建议：

- 若准备正式替换旧 UI，先执行 `npm run build:static`，再走部署回归清单。
- 若继续并行预览开发，保持 `npm run build`（输出 `static-ui-preview/`）。
