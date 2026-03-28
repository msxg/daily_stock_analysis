# DSA UI 多用户任务跟踪

## 1. 用途

用于多用户与租户预留改造的断点续做与验收记录，确保中断后可恢复。

配套文档：

- [DSA UI 多用户与租户预留方案](/Users/ddxx/Dev/TestWs/daily_stock_analysis/docs/dsa-ui-multi-user-proposal.md)

## 2. 状态定义

- `pending`：未开始
- `in_progress`：进行中
- `blocked`：阻塞
- `done`：完成并通过阶段门禁

## 3. 当前状态

| 项目 | 内容 |
| --- | --- |
| 当前阶段 | Phase 4 |
| 当前任务 | `MU-502` 联调验收与文档同步 |
| 总体状态 | `in_progress` |
| 当前阻塞 | 无 |
| 下一步 | 持续补齐普通用户与租户后续能力（UI 入口与权限细化） |

## 4. 阶段进度

| Phase | 名称 | 状态 | 说明 |
| --- | --- | --- | --- |
| Phase 0 | 文档与基础模型 | `done` | 方案/计划/跟踪文档 + 基础表与默认租户策略落地 |
| Phase 1 | 认证与 Principal | `done` | 登录、会话、`/auth/me`、中间件身份注入已完成 |
| Phase 2 | 数据隔离 | `done` | 聊天与持仓隔离已落地，租户维度预留已接入 |
| Phase 3 | dsa-ui 角色化改造 | `done` | 登录、路由守卫、导航与设置可见性改造已完成 |
| Phase 4 | 全量测试与验收 | `in_progress` | 单元/集成/视觉与后端凭据 E2E 已通过，验收收尾中 |

## 5. 任务清单

| 任务 ID | 阶段 | 任务 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| MU-000 | Phase 0 | 功能设计/技术方案/开发计划/记录模板落地 | `done` | 已落地文档与任务基线 |
| MU-100 | Phase 0 | 新增 tenant/user/membership/session/preference 模型 | `done` | `src/storage.py` 已新增模型 |
| MU-101 | Phase 0 | 默认租户与管理员引导策略 | `done` | `AuthIdentityService` 已实现 |
| MU-102 | Phase 0 | Phase 0 单元测试/集成测试 | `done` | 后端鉴权/配置/持仓链路测试通过 |
| MU-200 | Phase 1 | 登录改造（账号+密码） | `done` | `/auth/login` 支持用户名密码与首次引导 |
| MU-201 | Phase 1 | `/auth/me` 与 principal 解析 | `done` | `/auth/me` + middleware principal 已可用 |
| MU-202 | Phase 1 | 会话失效与退出登录 | `done` | `/auth/logout` 已支持会话失效 |
| MU-203 | Phase 1 | Phase 1 单元测试/集成测试 | `done` | `tests/test_auth*` 相关已通过 |
| MU-300 | Phase 2 | 聊天数据按用户隔离 | `done` | `agent` 端点已按用户会话隔离 |
| MU-301 | Phase 2 | 持仓数据按用户隔离 | `done` | `portfolio` 服务与仓储 owner 过滤已落地 |
| MU-302 | Phase 2 | 租户边界预留与鉴权中间件复用 | `done` | capability + tenant 结构预留完成 |
| MU-303 | Phase 2 | Phase 2 单元测试/集成测试 | `done` | `portfolio`/`agent` 相关测试通过 |
| MU-400 | Phase 3 | dsa-ui 登录页与 auth store 改造 | `done` | 登录页升级账号登录，守卫改用 `/auth/me` |
| MU-401 | Phase 3 | 路由守卫与导航可见性改造 | `done` | `AuthGate` + 壳层用户信息已接入 |
| MU-402 | Phase 3 | 设置页系统能力角色隔离 | `done` | 设置页按系统管理员权限控制 |
| MU-404 | Phase 3 | 用户管理独立导航页（列表/创建） | `done` | 左侧导航新增“用户管理”入口，复用 `/api/v1/auth/users` |
| MU-405 | Phase 3 | 用户管理补齐删除用户与管理员重置密码 | `done` | 新增重置密码与删除用户操作，含后端 API 与前端交互 |
| MU-406 | Phase 3 | 设置页新增“账号安全”分类并迁移个人改密入口 | `done` | 个人密码修改从 UI 分类迁移至账号安全分类 |
| MU-403 | Phase 3 | Phase 3 单元测试/集成测试 | `done` | `dsa-ui` 单元与集成测试通过 |
| MU-500 | Phase 4 | 浏览器 E2E（管理员/普通用户） | `done` | 已完成真实后端凭据模式验证（管理员账号） |
| MU-501 | Phase 4 | 浏览器视觉校验（样式/交互/数据） | `done` | `@visual` + `@perf` 全通过 |
| MU-502 | Phase 4 | 联调验收与变更文档同步 | `in_progress` | 文档与 changelog 持续更新中 |

## 6. 验证记录

| 日期 | 阶段/任务 | 命令 | 结果 | 备注 |
| --- | --- | --- | --- | --- |
| 2026-03-28 | MU-000 | 文档创建 | ✅ | 方案 + 跟踪已创建 |
| 2026-03-28 | MU-102 / MU-203 / MU-303 | `./venv/bin/python -m pytest tests/test_auth.py tests/test_auth_api.py tests/test_auth_status_setup_state.py tests/test_portfolio_api.py tests/test_system_config_api.py tests/test_cwe345_xff_bypass.py -q` | ✅ | 93 passed |
| 2026-03-28 | MU-303 | `./venv/bin/python -m pytest tests/test_agent_models_api.py tests/test_portfolio_service.py tests/test_portfolio_pr2.py tests/test_system_config_service.py -q` | ✅ | 91 passed |
| 2026-03-28 | MU-403 | `cd apps/dsa-ui && npm run lint && npm run test:unit && npm run test:integration && npm run build` | ✅ | Node 22.13.0 |
| 2026-03-28 | MU-501 | `cd apps/dsa-ui && npm run test:e2e && npm run test:visual && npm run test:perf` | ✅ | visual/perf 全通过，backend 场景默认 skip |
| 2026-03-28 | MU-500 | `cd apps/dsa-ui && npm run test:e2e:backend` | ✅ | 无后端凭据时自动 skip（2 skipped） |
| 2026-03-28 | MU-404 | `cd apps/dsa-ui && npm run lint && npm run test:integration && npm run build` | ✅ | 用户管理改为左侧独立导航入口后，前端校验与构建通过 |
| 2026-03-28 | MU-405 / MU-406 | `./venv/bin/python -m pytest tests/test_auth_api.py tests/test_auth.py -q` | ✅ | 覆盖用户删除、管理员重置密码及认证回归，共 55 passed |
| 2026-03-28 | MU-405 / MU-406 | `cd apps/dsa-ui && npm run lint && npm run test:unit && npm run test:integration && npm run build` | ✅ | 账号安全分类迁移 + 用户管理操作补齐后前端校验通过 |
| 2026-03-28 | MU-405 / MU-406 | `cd apps/dsa-ui && npx playwright test e2e/shell.spec.ts -g \"settings page supports local theme switching and persistence\"` | ✅ | 浏览器级视觉回归（设置页）通过 |
| 2026-03-28 | MU-405 | `./venv/bin/python -m pytest tests/test_auth_api.py -q && cd apps/dsa-ui && npm run test:integration -- users.integration.test.tsx` | ✅ | 新增删除接口兼容别名与前端 405 回退后验证通过（DELETE 受限场景可删除） |
| 2026-03-28 | MU-500 | `cd apps/dsa-ui && DSA_UI_E2E_USERNAME=admin DSA_UI_E2E_PASSWORD=*** npm run test:e2e:backend` | ✅ | 后端联调凭据模式通过（2 passed） |

## 7. 过程日志

### 2026-03-28

- 已确认产品决策：分析台与回测按租户共享，持仓按用户私有，UI 第一版显式 `system_admin/user`。
- 已创建多用户专项方案文档与任务跟踪文档。
- 已完成后端多用户基础模型、principal 注入、`/auth/me`、聊天/持仓隔离改造。
- 已完成 `dsa-ui` 登录守卫与设置权限可见性改造，并修复与新鉴权模型相关的集成测试基线。
- 已新增后端联调 E2E 认证辅助逻辑：若后端启用登录且未配置测试账号密码，`@backend` 用例自动 skip，避免误报。
- 已完成 `dsa-ui` “用户管理”左侧独立导航入口（用户列表 + 新建用户），保持后端 API 不变。
- 已完成“用户管理”扩展：新增删除用户、管理员重置用户密码（含后端 API、前端交互与测试）。
- 已完成设置页分类调整：用户修改自己密码迁移到新分类“账号安全”，UI 分类仅保留主题切换。
- 已修复“删除用户返回 Method Not Allowed”：新增 `POST /users/{id}/delete` 兼容别名，前端删除遇到 `405` 自动回退到兼容接口。
- 已完成具备真实账号凭据场景下的 `@backend` E2E 验证（管理员账号，2 条用例通过）。
- 下一步：继续收尾 MU-502，并推进普通用户与租户后续能力细化。

## 8. 中断恢复指引

1. 打开本文件，查看 `当前阶段`、`当前任务`、`过程日志`。
2. 先执行本阶段最低验证命令，确保环境可用。
3. 完成本阶段所有任务后，更新任务状态与验证记录。
4. 在 `docs/CHANGELOG.md` 增加本阶段变化摘要。
