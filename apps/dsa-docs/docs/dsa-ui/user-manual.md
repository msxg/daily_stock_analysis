---
title: DSA UI 操作手册
description: dsa-ui 全功能操作手册入口（分册）
sidebar_position: 1
---

# DSA UI 操作手册

本页为操作手册入口。  
完整内容已按功能拆分为多页，便于按模块查阅与培训使用。

## 分册目录

- [导航与入口](./manual/navigation)
- [分析台](./manual/dashboard)
- [问股](./manual/chat)
- [持仓](./manual/portfolio)
- [回测](./manual/backtest)
- [设置与登录](./manual/settings-login)

## 预览示意

![桌面端主导航](/img/dsa-ui-manual/01-shell-desktop-navigation.png)

## 维护与更新截图

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
