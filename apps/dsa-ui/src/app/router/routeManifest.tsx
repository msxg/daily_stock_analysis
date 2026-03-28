import type { LucideIcon } from 'lucide-react'
import {
  BriefcaseBusiness,
  ChartCandlestick,
  LayoutDashboard,
  MessageSquareQuote,
  Settings2,
  Users,
} from 'lucide-react'

export type NavRoute = {
  path: string
  label: string
  shortLabel: string
  description?: string
  icon: LucideIcon
  requiresSystemAdmin?: boolean
}

export const navRoutes: NavRoute[] = [
  {
    path: '/',
    label: '分析台',
    shortLabel: '分析',
    description: '支持分析提交、任务查询、历史管理，以及报告多维 Tab 浏览。',
    icon: LayoutDashboard,
  },
  {
    path: '/chat',
    label: '问股',
    shortLabel: '问股',
    description: '支持 Markdown 消息、流式进度、分析台上下文追问和移动端双视图切换。',
    icon: MessageSquareQuote,
  },
  {
    path: '/portfolio',
    label: '持仓',
    shortLabel: '持仓',
    description: '拆分为总览、持仓、录入、导入、流水五个任务面板，并保持全部后端 API 兼容。',
    icon: BriefcaseBusiness,
  },
  {
    path: '/backtest',
    label: '回测',
    shortLabel: '回测',
    description: '支持筛选、运行、KPI、趋势图与分页结果表，图表统一使用 lightweight-charts。',
    icon: ChartCandlestick,
  },
  {
    path: '/users',
    label: '用户管理',
    shortLabel: '用户',
    description: '支持系统管理员查看用户列表、创建用户、重置用户密码与删除用户。',
    icon: Users,
    requiresSystemAdmin: true,
  },
  {
    path: '/settings',
    label: '设置',
    shortLabel: '设置',
    description: '支持分类导航、Theme 切换、配置校验、认证管理、渠道测试和桌面端 env 导入导出。',
    icon: Settings2,
  },
]

export function getMatchedRoute(pathname: string): NavRoute | undefined {
  return navRoutes.find((item) => (item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)))
}

export function getRouteLabel(pathname: string): string {
  const matchedRoute = getMatchedRoute(pathname)
  return matchedRoute?.label ?? 'DSA UI'
}

export function getRouteDescription(pathname: string): string {
  return getMatchedRoute(pathname)?.description ?? ''
}
