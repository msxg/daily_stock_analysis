# DSA UI 多用户与租户预留方案

## 1. 目标与范围

目标：在不改变现有核心业务功能点的前提下，为项目新增可落地的多用户体系与数据隔离能力，并预留未来多租户扩展。

本次前端范围仅包含：`apps/dsa-ui`。

本次后端范围包含认证、会话、权限、数据访问边界，不包含与本需求无关的业务重构。

## 2. 现状问题

当前系统以“管理员密码 + Cookie”作为单入口认证，无法表达“用户身份、角色、租户上下文”。

主要不足：

- 认证模型仅支持单管理员，不支持用户账号体系。
- 会话模型无法绑定用户实体，权限与可见性粒度不足。
- 聊天会话与部分业务数据没有稳定用户归属约束。
- `dsa-ui` 路由守卫仅判断是否登录，缺少角色权限判定。
- 设置页存在系统级能力暴露给普通登录态的风险。

## 3. 目标模型

### 3.1 身份与租户模型

基础实体：

- `Tenant`（租户）
- `User`（用户）
- `TenantMembership`（用户-租户成员关系）
- `UserSession`（登录会话）
- `UserPreference`（用户偏好）

角色策略：

- 第一版显式角色：`system_admin`、`user`
- 预留角色：`tenant_admin`（仅模型与权限映射预留，UI 暂不显式展示）

### 3.2 数据隔离策略

- 系统级（仅 `system_admin`）：系统配置、认证管理、用户管理、租户管理。
- 租户级（共享）：分析台历史、回测结果（默认租户可见，跨租户隔离）。
- 用户级（私有）：问股会话、个人持仓账户、个人偏好（同租户下用户隔离）。

## 4. dsa-ui 可见性与权限

页面可见性（第一版）：

- `Dashboard / Chat / Portfolio / Backtest`：`system_admin` 与 `user` 均可见。
- `Settings > 系统`：仅 `system_admin` 可见。
- `Settings > 用户与租户`：仅 `system_admin` 可见。
- `Settings > 个人 / UI`：所有登录用户可见。

交互原则：

- 前端不再决定“谁是谁”，仅消费 `/api/v1/auth/me` 返回的身份与能力。
- 导航、路由、设置分组都基于 capability 判定。

## 5. 技术方案

### 5.1 后端

认证与会话：

- 新增用户会话表，Cookie 绑定到会话记录（可失效、可审计）。
- 中间件解析当前 principal：`user_id + tenant_id + role/capabilities`。
- 保留 `ADMIN_AUTH_ENABLED` 作为总开关，兼容现有部署。

认证 API：

- 兼容并扩展 `/api/v1/auth/login`：支持 `username + password`。
- 新增 `/api/v1/auth/me`：返回当前用户、租户、角色、能力。
- 保留 `/api/v1/auth/status` 兼容老前端字段。
- `/api/v1/auth/logout` 改为失效当前会话记录。

授权策略：

- 系统级 API 增加 `system_admin` 校验。
- 用户私有数据按 `owner_user_id` 强制过滤。
- 租户共享数据按 `tenant_id` 过滤。

### 5.2 前端（仅 dsa-ui）

- 登录页由“管理员密码”升级为“账号 + 密码”。
- `AuthGate` 改用 `/auth/me` 识别身份与权限。
- `AppShell` 顶部显示当前用户信息，并支持退出登录。
- 设置页按角色动态显示系统项与管理项。
- API 客户端保持 `withCredentials`，401 统一跳转登录页。

## 6. 分阶段开发计划

### Phase 0：文档与基础模型

- 输出功能设计、技术方案、开发计划、任务跟踪文档。
- 建立基础数据表（tenant/user/membership/session/preference）。
- 建立默认租户与系统管理员引导策略。

### Phase 1：认证与 Principal

- 完成账户登录、会话签发、会话失效。
- 增加 `/auth/me` 并在中间件注入 principal。
- 补齐认证单元测试与集成测试。

### Phase 2：数据隔离

- 聊天会话按用户隔离。
- 持仓账户与相关写操作按用户隔离。
- 分析/回测先按默认租户隔离（预留多租户扩展）。

### Phase 3：dsa-ui 角色化改造

- 登录页、路由守卫、导航可见性改造。
- 设置页拆分个人与系统能力区。
- 管理员与普通用户体验差异落地。

### Phase 4：测试与验收

- 单元测试、集成测试、端到端测试闭环。
- 浏览器视觉测试覆盖样式、交互、数据准确性。
- 产出阶段验收记录与风险清单。

## 7. 测试策略

每一阶段均必须至少包含：

- 单元测试：核心函数、权限判断、映射逻辑。
- 集成测试：API + 中间件 + 数据层联动。
- 浏览器 E2E：关键用户路径验证。
- 视觉回归：关键页面截图比对。

E2E 验证重点：

- 管理员登录、普通用户登录。
- 普通用户不可见系统设置。
- 聊天与持仓数据隔离生效。
- 样式与交互在桌面/移动端可用。

## 8. 风险与应对

- 旧认证兼容风险：保留 `status` 返回形状与 `ADMIN_AUTH_ENABLED` 总开关。
- 历史数据归属风险：通过默认租户 + 显式迁移脚本处理。
- 接口稳定性风险：外部模型调用链路不稳定时，测试阶段统一重试并记录。

## 9. 交付物清单

- 多用户方案文档（本文件）
- 多用户任务跟踪文档
- 后端代码与测试
- `dsa-ui` 代码与测试
- 浏览器视觉测试报告与截图证据
- `docs/CHANGELOG.md` 变更记录

## 10. 当前实现快照（2026-03-28）

- 后端：已落地 `Tenant/User/TenantMembership/UserSession/UserPreference` 模型与 `AuthIdentityService`。
- 后端：`/api/v1/auth/me`、账号登录、会话失效、principal 注入已可用，`/auth/status` 兼容字段保留。
- 后端：聊天会话已按用户隔离，持仓（账户/交易/流水/风险）已按 owner 用户隔离。
- 前端（`dsa-ui`）：登录页改为账号体系，`AuthGate` 改为基于 `/auth/me`，设置页按系统管理员权限控制系统配置区域。
- 前端（`dsa-ui`）：用户管理已支持“创建 / 删除 / 管理员重置密码”，个人改密已迁移到“账号安全”分类，`UI` 分类仅保留主题切换。
- 测试：单元/集成/浏览器视觉链路已覆盖并通过；`@backend` E2E 在无账号凭据时会自动跳过，避免误报。

## 11. 测试执行要求落地（执行层）

必跑命令（每阶段完成后）：

- 后端单元/集成：
  - `./venv/bin/python -m pytest tests/test_auth.py tests/test_auth_api.py tests/test_auth_status_setup_state.py tests/test_portfolio_api.py tests/test_system_config_api.py tests/test_cwe345_xff_bypass.py -q`
  - `./venv/bin/python -m pytest tests/test_agent_models_api.py tests/test_portfolio_service.py tests/test_portfolio_pr2.py tests/test_system_config_service.py -q`
- `dsa-ui` 单元/集成：
  - `cd apps/dsa-ui && npm run lint`
  - `cd apps/dsa-ui && npm run test:unit`
  - `cd apps/dsa-ui && npm run test:integration`
  - `cd apps/dsa-ui && npm run build`
- 浏览器级验证：
  - `cd apps/dsa-ui && npm run test:e2e`
  - `cd apps/dsa-ui && npm run test:visual`
  - `cd apps/dsa-ui && npm run test:perf`
  - `cd apps/dsa-ui && npm run test:e2e:backend`（需要后端凭据时设置 `DSA_UI_E2E_USERNAME/DSA_UI_E2E_PASSWORD`）
