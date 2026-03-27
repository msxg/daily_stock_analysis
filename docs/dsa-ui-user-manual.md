---
title: DSA UI 操作手册
description: dsa-ui 全功能操作手册（含标注截图）
sidebar_position: 20
---

# DSA UI 操作手册

本文档按功能模块说明 `apps/dsa-ui` 的主要操作路径。  
所有截图均使用红色方框标注关键操作入口（菜单、按钮、输入框等）。

## 1. 导航与入口

### 1.1 桌面端主导航

操作说明：

1. 左侧主导航可在 `分析台 / 问股 / 持仓 / 回测 / 设置` 之间切换。
2. 点击菜单后，右侧内容区会切换到对应功能页。

![桌面端主导航](./assets/dsa-ui-manual/01-shell-desktop-navigation.png)

### 1.2 移动端导航

操作说明：

1. 移动端底部导航用于快速切换模块。
2. 分析台页面额外提供“历史/报告”双视图切换。

![移动端主导航](./assets/dsa-ui-manual/17-mobile-navigation.png)

---

## 2. 分析台

### 2.1 提交分析任务

操作说明：

1. 在“股票代码/名称”输入框输入标的。
2. 根据需要勾选/取消“推送通知”。
3. 点击“提交分析”，观察结果提示。

![提交分析任务](./assets/dsa-ui-manual/02-dashboard-submit-analysis.png)

### 2.2 查看任务、历史与报告快捷操作

操作说明：

1. 左侧查看任务状态与历史分析。
2. 在报告区使用 `复制摘要 / 查看 Markdown / 追问 AI` 快捷操作。

![历史与报告操作](./assets/dsa-ui-manual/03-dashboard-history-and-actions.png)

### 2.3 查看 Markdown 报告

操作说明：

1. 点击报告标签中的 `Markdown`。
2. 在 Markdown 内容区查看原始报告文本。

![Markdown 报告](./assets/dsa-ui-manual/04-dashboard-markdown-tab.png)

---

## 3. 问股

### 3.1 上下文追问与输入

操作说明：

1. 从分析台点击“追问 AI”进入问股页。
2. 页面顶部显示“已注入追问上下文”提示。
3. 选择策略、输入问题后点击“发送提问”。

![问股上下文与输入](./assets/dsa-ui-manual/05-chat-context-and-input.png)

### 3.2 流式过程与结果反馈

操作说明：

1. 发送后在“流式状态面板”查看进度。
2. 通过状态标签确认是否完成。
3. 查看“消息已发送，AI 回复已更新”反馈。

![问股流式反馈](./assets/dsa-ui-manual/06-chat-stream-timeline.png)

### 3.3 会话操作（新建/导出/发送）

操作说明：

1. 点击“新建会话”创建新的问答上下文。
2. 点击“导出 Markdown”导出会话内容。
3. 点击“发送会话内容”推送到通知渠道。

![会话操作](./assets/dsa-ui-manual/07-chat-session-operations.png)

### 3.4 移动端问股双面板

操作说明：

1. 使用上方切换器在“会话列表/消息面板”之间切换。
2. 在消息面板底部输入并发送问题。

![移动端问股双面板](./assets/dsa-ui-manual/18-mobile-chat-switcher.png)

---

## 4. 持仓

### 4.1 顶部控制与禁写保护

操作说明：

1. 先选择账户和成本法。
2. 当账户为“全部账户”时，系统会显示禁写提示。
3. 需要写入（录入/导入/删除）时，先切换到具体账户。

![持仓顶部控制与禁写](./assets/dsa-ui-manual/08-portfolio-overview-and-protection.png)

### 4.2 手工录入交易

操作说明：

1. 切换到“手工录入”标签。
2. 输入股票代码、数量、价格等字段。
3. 点击“提交交易流水”完成录入。

![手工录入交易](./assets/dsa-ui-manual/09-portfolio-entry-form.png)

### 4.3 CSV 导入

操作说明：

1. 切换到“CSV 导入”标签。
2. 选择券商格式并上传 CSV 文件。
3. 点击“解析文件”预览后，再点击“提交导入”。

![CSV 导入流程](./assets/dsa-ui-manual/10-portfolio-import-flow.png)

### 4.4 流水与修正

操作说明：

1. 切换到“流水与修正”标签。
2. 选择流水类型并刷新。
3. 在流水列表中进行核对与后续修正操作。

![流水与修正](./assets/dsa-ui-manual/11-portfolio-events-management.png)

---

## 5. 回测

### 5.1 过滤与运行

操作说明：

1. 输入股票代码（可留空全量）。
2. 设置评估窗口并点击“应用筛选”。
3. 点击“运行回测”执行任务。

![回测控制区](./assets/dsa-ui-manual/12-backtest-controls.png)

### 5.2 结果阅读

操作说明：

1. 查看运行结果摘要（processed/saved/completed 等）。
2. 关注 KPI（如方向准确率）。
3. 结合趋势图与结果表格进行复盘。

![回测结果与 KPI](./assets/dsa-ui-manual/13-backtest-results-and-kpi.png)

---

## 6. 设置

### 6.1 UI 主题切换

操作说明：

1. 点击左侧分类中的 `UI`。
2. 在 `Theme` 面板中选择 `玫瑰红` 或 `浅绿`。
3. 主题会立即生效，并自动保存到当前浏览器。

### 6.2 配置搜索、分类与保存

操作说明：

1. 通过搜索框定位配置项。
2. 点击左侧分类切换配置分组。
3. 修改字段后，使用“保存配置”提交；底部会出现脏数据保存条提示。

![配置编辑与保存](./assets/dsa-ui-manual/14-settings-config-save.png)

### 6.3 系统分类中的认证与 env 工具

操作说明：

1. 切换到左侧 `系统` 分类。
2. 在认证区域启用/调整认证并保存。
3. 使用“导出 .env / 导入 .env”做备份与恢复。

![认证与工具操作](./assets/dsa-ui-manual/15-settings-auth-env-tools.png)

### 6.4 模型与渠道分类中的 LLM 测试

操作说明：

1. 切换到左侧 `模型与渠道` 分类。
2. 填写渠道名称、协议、模型等参数。
3. 点击“测试渠道”验证链路可用性。

---

## 7. 登录

### 7.1 管理员登录

操作说明：

1. 先阅读认证状态提示。
2. 输入管理员密码。
3. 点击“登录”进入工作台。

![登录页面](./assets/dsa-ui-manual/16-login-page.png)

---

## 8. 维护与更新截图

截图资产目录：

- `docs/assets/dsa-ui-manual/`

重新生成截图命令：

```bash
cd apps/dsa-ui
eval "$(fnm env)"
npm run dev -- --host 127.0.0.1 --port 4174
```

新开一个终端执行：

```bash
cd apps/dsa-ui
eval "$(fnm env)"
npm run manual:assets
```

---

## 9. Docusaurus 集成建议

本文档已使用 Docusaurus 兼容 frontmatter，可直接纳入 Docusaurus `docs/`。  
若后续启用 Docusaurus，建议将本手册拆分为多页结构：

1. `dsa-ui/manual/navigation.md`
2. `dsa-ui/manual/dashboard.md`
3. `dsa-ui/manual/chat.md`
4. `dsa-ui/manual/portfolio.md`
5. `dsa-ui/manual/backtest.md`
6. `dsa-ui/manual/settings-login.md`

并在 `sidebars.js` 中挂载为「DSA UI 操作手册」分类，以便团队培训和交接。
