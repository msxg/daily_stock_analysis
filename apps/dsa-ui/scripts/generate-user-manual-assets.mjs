import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const outputDir = path.resolve(__dirname, '../../../docs/assets/dsa-ui-manual')

const mockHistoryItems = [
  {
    id: 101,
    query_id: 'q-mock-101',
    stock_code: '600519',
    stock_name: '贵州茅台',
    report_type: 'detailed',
    sentiment_score: 67,
    operation_advice: '持有',
    created_at: '2026-03-26T09:30:00+08:00',
  },
  {
    id: 102,
    query_id: 'q-mock-102',
    stock_code: 'AAPL',
    stock_name: 'Apple',
    report_type: 'detailed',
    sentiment_score: 63,
    operation_advice: '观察',
    created_at: '2026-03-26T08:10:00+08:00',
  },
]

const mockChatSessions = [
  {
    session_id: 'session-001',
    title: '技术分析复盘',
    message_count: 4,
    created_at: '2026-03-26T09:10:00+08:00',
    last_active: '2026-03-26T09:20:00+08:00',
  },
  {
    session_id: 'session-002',
    title: '白酒板块观察',
    message_count: 2,
    created_at: '2026-03-26T08:40:00+08:00',
    last_active: '2026-03-26T08:56:00+08:00',
  },
]

const mockSessionMessages = {
  'session-001': [
    {
      id: 'm-001',
      role: 'user',
      content: '请分析贵州茅台的短线趋势',
      created_at: '2026-03-26T09:10:01+08:00',
    },
    {
      id: 'm-002',
      role: 'assistant',
      content: '<think>先看趋势与成交量</think>\n\n**结论**：短线偏强，可分批布局。',
      created_at: '2026-03-26T09:10:05+08:00',
    },
  ],
  'session-002': [
    {
      id: 'm-101',
      role: 'user',
      content: '白酒板块近期能否继续配置？',
      created_at: '2026-03-26T08:40:01+08:00',
    },
    {
      id: 'm-102',
      role: 'assistant',
      content: '建议分批配置，优先关注龙头成交量变化。',
      created_at: '2026-03-26T08:40:06+08:00',
    },
  ],
}

function reportDetail(recordId) {
  if (recordId === 101) {
    return {
      meta: {
        id: 101,
        query_id: 'q-mock-101',
        stock_code: '600519',
        stock_name: '贵州茅台',
        report_type: 'detailed',
        report_language: 'zh',
        model_used: 'openai/gpt-5.4',
        created_at: '2026-03-26T09:30:00+08:00',
        current_price: 1823.5,
        change_pct: 1.28,
      },
      summary: {
        analysis_summary: '趋势保持震荡上行，短期波动可控。',
        operation_advice: '分批持有，回踩再加仓。',
        trend_prediction: '未来 5 个交易日偏震荡上行。',
        sentiment_score: 67,
      },
      strategy: {
        ideal_buy: '1800 元附近分批介入，放量确认再加仓。',
        secondary_buy: '1770 元附近止跌后小仓位试错。',
        stop_loss: '跌破 1730 元且次日无收复则减仓。',
        take_profit: '反弹至 1880 元附近分段止盈。',
      },
      details: {
        news_content: '今日板块资金净流入，机构关注高端白酒估值修复节奏。',
        raw_result: {
          decision_type: 'hold',
          confidence_level: '中',
          data_sources: 'mock:manual',
          dashboard: {
            battle_plan: {
              action_checklist: ['✅ 趋势偏多', '⚠️ 注意回踩确认', '✅ 量价结构健康'],
            },
          },
        },
        context_snapshot: {
          realtime_quote: {
            price: 1823.5,
            change_pct: 1.28,
            volume_ratio: 1.08,
            turnover_rate: 0.43,
          },
          trend_result: {
            trend_status: '震荡上行',
            signal_score: 71,
          },
          fundamental_context: {
            errors: ['fundamental_bundle timeout'],
          },
        },
        belong_boards: [
          { name: '白酒', code: 'BK0477' },
          { name: '消费', code: 'BK1024' },
          { name: '沪股通', code: 'BK0707' },
        ],
      },
    }
  }
  return {
    meta: {
      id: 102,
      query_id: 'q-mock-102',
      stock_code: 'AAPL',
      stock_name: 'Apple',
      report_type: 'detailed',
      report_language: 'zh',
      model_used: 'openai/gpt-5.4',
      created_at: '2026-03-26T08:10:00+08:00',
      current_price: 210.2,
      change_pct: 0.73,
    },
    summary: {
      analysis_summary: '关注财报前后波动，保持中性偏多。',
      operation_advice: '不追高，回踩支撑后再评估。',
      trend_prediction: '短期区间震荡。',
      sentiment_score: 63,
    },
    strategy: {
      ideal_buy: '205 美元附近',
      secondary_buy: '201 美元附近',
      stop_loss: '跌破 198 美元',
      take_profit: '215 美元附近分批止盈',
    },
    details: {
      news_content: '科技板块波动加大，关注财报数据。',
    },
  }
}

function newsList(recordId) {
  if (recordId !== 101) {
    return { total: 1, items: [{ title: 'Apple 新品发布临近', snippet: '市场关注度提升。', url: 'https://example.com/news/apple-1' }] }
  }
  return {
    total: 2,
    items: [
      {
        title: '白酒板块午后走强',
        snippet: '机构资金回流消费龙头，板块成交额较昨日明显放大。',
        url: 'https://example.com/news/baijiu-1',
      },
      {
        title: '贵州茅台发布经营数据',
        snippet: '公司公告显示核心单品需求保持稳定，渠道库存结构改善。',
        url: 'https://example.com/news/baijiu-2',
      },
    ],
  }
}

const mockConfigItems = [
  {
    key: 'OPENAI_MODEL',
    value: 'gpt-4o-mini',
    raw_value_exists: true,
    is_masked: false,
    schema: {
      key: 'OPENAI_MODEL',
      title: '默认模型',
      description: '默认推理模型',
      category: 'ai_model',
      data_type: 'string',
      ui_control: 'text',
      is_sensitive: false,
      is_required: true,
      is_editable: true,
      options: [],
      validation: {},
      display_order: 20,
    },
  },
  {
    key: 'ENABLE_NOTIFY',
    value: 'true',
    raw_value_exists: true,
    is_masked: false,
    schema: {
      key: 'ENABLE_NOTIFY',
      title: '通知开关',
      description: '是否开启通知',
      category: 'notification',
      data_type: 'boolean',
      ui_control: 'switch',
      is_sensitive: false,
      is_required: false,
      is_editable: true,
      options: [],
      validation: {},
      display_order: 10,
    },
  },
]

async function setupMockApi(page) {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())
    const pathname = url.pathname

    const json = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })

    if (pathname === '/api/v1/health' && method === 'GET') {
      return json({ ok: true })
    }

    if (pathname === '/api/v1/analysis/tasks' && method === 'GET') {
      return json({
        total: 1,
        pending: 0,
        processing: 0,
        tasks: [
          {
            task_id: 'task-mock-001',
            stock_code: '600519',
            stock_name: '贵州茅台',
            status: 'completed',
            progress: 100,
            message: '分析完成',
            report_type: 'detailed',
            created_at: '2026-03-26T09:31:00+08:00',
          },
        ],
      })
    }

    if (pathname === '/api/v1/analysis/analyze' && method === 'POST') {
      return json(
        {
          accepted: [{ task_id: 'task-mock-002', stock_code: '600519', status: 'pending' }],
          duplicates: [],
          message: '已加入队列',
        },
        202,
      )
    }

    if (pathname === '/api/v1/history' && method === 'GET') {
      return json({
        total: mockHistoryItems.length,
        page: 1,
        limit: 20,
        items: mockHistoryItems,
      })
    }

    if (pathname === '/api/v1/history' && method === 'DELETE') {
      return json({ deleted: 1 })
    }

    const historyDetail = pathname.match(/^\/api\/v1\/history\/(\d+)$/)
    if (historyDetail && method === 'GET') {
      return json(reportDetail(Number(historyDetail[1])))
    }

    const historyNews = pathname.match(/^\/api\/v1\/history\/(\d+)\/news$/)
    if (historyNews && method === 'GET') {
      return json(newsList(Number(historyNews[1])))
    }

    const historyMarkdown = pathname.match(/^\/api\/v1\/history\/(\d+)\/markdown$/)
    if (historyMarkdown && method === 'GET') {
      const id = Number(historyMarkdown[1])
      if (id === 101) {
        return json({
          content: '# 贵州茅台\n\n- 观点：继续观察回踩后的承接力度。\n- 操作：不追高，分批执行。',
        })
      }
      return json({ content: '# Apple\n\n- 观点：等待关键位确认。' })
    }

    if (pathname === '/api/v1/agent/skills' && method === 'GET') {
      return json({
        default_skill_id: 'bull_trend',
        skills: [
          { id: 'bull_trend', name: '趋势策略', description: '适合顺势行情，关注均线与量价结构。' },
          { id: 'chan_theory', name: '缠论', description: '关注中枢与笔段结构，适合节奏研判。' },
          { id: 'wave_theory', name: '波浪理论', description: '关注主升浪与调整浪结构。' },
        ],
      })
    }

    if (pathname === '/api/v1/agent/chat/sessions' && method === 'GET') {
      return json({ sessions: mockChatSessions })
    }

    const sessionMessages = pathname.match(/^\/api\/v1\/agent\/chat\/sessions\/([^/]+)$/)
    if (sessionMessages && method === 'GET') {
      const sessionId = decodeURIComponent(sessionMessages[1])
      return json({
        session_id: sessionId,
        messages: mockSessionMessages[sessionId] || [],
      })
    }

    if (sessionMessages && method === 'DELETE') {
      return json({ deleted: 1 })
    }

    if (pathname === '/api/v1/agent/chat/send' && method === 'POST') {
      return json({ success: true })
    }

    if (pathname === '/api/v1/agent/chat/stream' && method === 'POST') {
      const body = await request.postDataJSON()
      const question = String(body?.message || '')
      const sessionId = String(body?.session_id || 'session-001')
      const stockCode = typeof body?.context?.stock_code === 'string' ? body.context.stock_code : '未指定代码'
      const streamPayload = [
        { type: 'thinking', step: 1, message: '正在制定分析路径...' },
        { type: 'tool_start', step: 1, tool: 'get_realtime_quote', display_name: '获取实时行情' },
        { type: 'tool_done', step: 1, tool: 'get_realtime_quote', display_name: '获取实时行情', success: true },
        {
          type: 'done',
          success: true,
          content: `**追问目标**：${stockCode}\n\n- 问题：${question}\n- 结论：建议分批布局并设置保护位。`,
          session_id: sessionId,
          total_steps: 2,
        },
      ]
        .map((event) => `data: ${JSON.stringify(event)}\n\n`)
        .join('')

      return route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: streamPayload,
      })
    }

    if (pathname === '/api/v1/portfolio/accounts' && method === 'GET') {
      return json({
        accounts: [
          {
            id: 1,
            owner_id: 'demo-user',
            name: '主账户',
            broker: 'Demo',
            market: 'cn',
            base_currency: 'CNY',
            is_active: true,
          },
          {
            id: 2,
            owner_id: 'demo-user',
            name: '港股账户',
            broker: 'Demo HK',
            market: 'hk',
            base_currency: 'HKD',
            is_active: true,
          },
        ],
      })
    }

    if (pathname === '/api/v1/portfolio/accounts' && method === 'POST') {
      return json({
        id: 3,
        owner_id: 'demo-user',
        name: '新账户',
        broker: 'Demo',
        market: 'cn',
        base_currency: 'CNY',
        is_active: true,
      })
    }

    if (pathname === '/api/v1/portfolio/snapshot' && method === 'GET') {
      return json({
        as_of: '2026-03-26',
        cost_method: 'fifo',
        currency: 'CNY',
        account_count: 2,
        total_cash: 80000,
        total_market_value: 210000,
        total_equity: 290000,
        realized_pnl: 5200,
        unrealized_pnl: 8600,
        fee_total: 123,
        tax_total: 87,
        fx_stale: false,
        accounts: [
          {
            account_id: 1,
            account_name: '主账户',
            market: 'cn',
            base_currency: 'CNY',
            as_of: '2026-03-26',
            cost_method: 'fifo',
            total_cash: 50000,
            total_market_value: 150000,
            total_equity: 200000,
            realized_pnl: 3500,
            unrealized_pnl: 6000,
            fee_total: 80,
            tax_total: 60,
            fx_stale: false,
            positions: [
              {
                symbol: '600519',
                market: 'cn',
                currency: 'CNY',
                quantity: 100,
                avg_cost: 1750,
                total_cost: 175000,
                last_price: 1820,
                market_value_base: 182000,
                unrealized_pnl_base: 7000,
                valuation_currency: 'CNY',
              },
            ],
          },
        ],
      })
    }

    if (pathname === '/api/v1/portfolio/risk' && method === 'GET') {
      return json({
        as_of: '2026-03-26',
        account_id: null,
        cost_method: 'fifo',
        currency: 'CNY',
        thresholds: {},
        concentration: {
          total_market_value: 210000,
          top_weight_pct: 42.5,
          alert: false,
          top_positions: [{ symbol: '600519', market_value_base: 182000, weight_pct: 42.5, is_alert: false }],
        },
        sector_concentration: {
          total_market_value: 210000,
          top_weight_pct: 42.5,
          alert: false,
          top_sectors: [],
          coverage: {},
          errors: [],
        },
        drawdown: {
          series_points: 90,
          max_drawdown_pct: 8.4,
          current_drawdown_pct: 2.1,
          alert: false,
          fx_stale: false,
        },
        stop_loss: {
          near_alert: false,
          triggered_count: 0,
          near_count: 1,
          items: [],
        },
      })
    }

    if (pathname === '/api/v1/portfolio/fx/refresh' && method === 'POST') {
      return json({
        as_of: '2026-03-26',
        account_count: 2,
        pair_count: 3,
        updated_count: 3,
        stale_count: 0,
        error_count: 0,
        refresh_enabled: true,
        disabled_reason: null,
      })
    }

    if (pathname === '/api/v1/portfolio/trades' && method === 'GET') {
      return json({
        items: [
          {
            id: 301,
            account_id: 1,
            symbol: '600519',
            market: 'cn',
            currency: 'CNY',
            trade_date: '2026-03-20',
            side: 'buy',
            quantity: 100,
            price: 1820,
            fee: 5,
            tax: 0,
          },
        ],
        total: 1,
        page: 1,
        page_size: 20,
      })
    }

    if (pathname === '/api/v1/portfolio/cash-ledger' && method === 'GET') {
      return json({
        items: [
          {
            id: 401,
            account_id: 1,
            event_date: '2026-03-18',
            direction: 'in',
            amount: 50000,
            currency: 'CNY',
          },
        ],
        total: 1,
        page: 1,
        page_size: 20,
      })
    }

    if (pathname === '/api/v1/portfolio/corporate-actions' && method === 'GET') {
      return json({
        items: [
          {
            id: 501,
            account_id: 1,
            symbol: '600519',
            market: 'cn',
            currency: 'CNY',
            effective_date: '2026-03-10',
            action_type: 'cash_dividend',
            cash_dividend_per_share: 2.5,
          },
        ],
        total: 1,
        page: 1,
        page_size: 20,
      })
    }

    if (pathname.startsWith('/api/v1/portfolio/trades') && method === 'POST') return json({ id: 9001 })
    if (pathname.startsWith('/api/v1/portfolio/cash-ledger') && method === 'POST') return json({ id: 9002 })
    if (pathname.startsWith('/api/v1/portfolio/corporate-actions') && method === 'POST') return json({ id: 9003 })
    if (pathname.startsWith('/api/v1/portfolio/trades/') && method === 'DELETE') return json({ deleted: 1 })
    if (pathname.startsWith('/api/v1/portfolio/cash-ledger/') && method === 'DELETE') return json({ deleted: 1 })
    if (pathname.startsWith('/api/v1/portfolio/corporate-actions/') && method === 'DELETE') return json({ deleted: 1 })

    if (pathname === '/api/v1/portfolio/imports/csv/brokers' && method === 'GET') {
      return json({
        brokers: [
          { broker: 'huatai', aliases: ['ht'], display_name: '华泰' },
          { broker: 'citic', aliases: ['zx'], display_name: '中信' },
        ],
      })
    }

    if (pathname === '/api/v1/portfolio/imports/csv/parse' && method === 'POST') {
      return json({
        broker: 'huatai',
        record_count: 3,
        skipped_count: 1,
        error_count: 0,
        records: [],
        errors: [],
      })
    }

    if (pathname === '/api/v1/portfolio/imports/csv/commit' && method === 'POST') {
      return json({
        account_id: 1,
        record_count: 3,
        inserted_count: 2,
        duplicate_count: 1,
        failed_count: 0,
        dry_run: false,
        errors: [],
      })
    }

    if (pathname === '/api/v1/backtest/results' && method === 'GET') {
      const code = (url.searchParams.get('code') || '').toUpperCase()
      const all = [
        {
          analysis_history_id: 9001,
          code: '600519',
          analysis_date: '2026-03-10',
          eval_window_days: 10,
          engine_version: 'v1',
          eval_status: 'completed',
          operation_advice: '持有',
          outcome: 'win',
          simulated_return_pct: 4.8,
          stock_return_pct: 3.1,
        },
        {
          analysis_history_id: 9002,
          code: 'AAPL',
          analysis_date: '2026-03-11',
          eval_window_days: 10,
          engine_version: 'v1',
          eval_status: 'completed',
          operation_advice: '观察',
          outcome: 'neutral',
          simulated_return_pct: 0.5,
          stock_return_pct: 0.2,
        },
      ]
      const items = code ? all.filter((item) => item.code === code) : all
      return json({
        total: items.length,
        page: 1,
        limit: 20,
        items,
      })
    }

    if (pathname === '/api/v1/backtest/performance' && method === 'GET') {
      return json({
        scope: 'overall',
        eval_window_days: 10,
        engine_version: 'v1',
        total_evaluations: 3,
        completed_count: 2,
        insufficient_count: 1,
        long_count: 2,
        cash_count: 1,
        win_count: 1,
        loss_count: 1,
        neutral_count: 1,
        direction_accuracy_pct: 66.7,
        win_rate_pct: 50,
        avg_simulated_return_pct: 1.03,
        avg_stock_return_pct: 0.78,
        stop_loss_trigger_rate: 12.3,
        take_profit_trigger_rate: 25.8,
        advice_breakdown: {},
        diagnostics: {},
      })
    }

    const stockPerf = pathname.match(/^\/api\/v1\/backtest\/performance\/([^/]+)$/)
    if (stockPerf && method === 'GET') {
      return json({
        scope: 'stock',
        code: decodeURIComponent(stockPerf[1]).toUpperCase(),
        eval_window_days: 10,
        engine_version: 'v1',
        total_evaluations: 2,
        completed_count: 1,
        insufficient_count: 1,
        long_count: 1,
        cash_count: 1,
        win_count: 1,
        loss_count: 0,
        neutral_count: 0,
        direction_accuracy_pct: 100,
        win_rate_pct: 100,
        avg_simulated_return_pct: 3.6,
        avg_stock_return_pct: 3.1,
        advice_breakdown: {},
        diagnostics: {},
      })
    }

    if (pathname === '/api/v1/backtest/run' && method === 'POST') {
      return json({
        processed: 3,
        saved: 3,
        completed: 2,
        insufficient: 1,
        errors: 0,
      })
    }

    if (pathname === '/api/v1/system/config' && method === 'GET') {
      return json({
        config_version: 'v-mock-1',
        mask_token: '******',
        items: mockConfigItems,
        updated_at: '2026-03-26T10:00:00+08:00',
      })
    }

    if (pathname === '/api/v1/system/config/schema' && method === 'GET') {
      return json({ schema_version: 'mock-1', categories: [] })
    }

    if (pathname === '/api/v1/system/config/validate' && method === 'POST') {
      return json({ valid: true, issues: [] })
    }

    if (pathname === '/api/v1/system/config' && method === 'PUT') {
      return json({
        success: true,
        config_version: 'v-mock-2',
        applied_count: 1,
        skipped_masked_count: 0,
        reload_triggered: true,
        updated_keys: ['OPENAI_MODEL'],
        warnings: [],
      })
    }

    if (pathname === '/api/v1/system/config/export' && method === 'GET') {
      return json({
        content: 'ENABLE_NOTIFY=true\nOPENAI_MODEL=gpt-4o-mini\n',
        config_version: 'v-mock-1',
      })
    }

    if (pathname === '/api/v1/system/config/import' && method === 'POST') {
      return json({
        success: true,
        config_version: 'v-mock-3',
        applied_count: 2,
        skipped_masked_count: 0,
        reload_triggered: true,
        updated_keys: ['ENABLE_NOTIFY', 'OPENAI_MODEL'],
        warnings: [],
      })
    }

    if (pathname === '/api/v1/system/config/llm/test-channel' && method === 'POST') {
      return json({
        success: true,
        message: '渠道 quick-test 测试成功',
        error: null,
        resolved_protocol: 'openai',
        resolved_model: 'gpt-4o-mini',
        latency_ms: 128,
      })
    }

    if (pathname === '/api/v1/auth/status' && method === 'GET') {
      return json({
        auth_enabled: true,
        logged_in: false,
        password_set: true,
        password_changeable: true,
        setup_state: 'enabled',
      })
    }

    if (pathname === '/api/v1/auth/settings' && method === 'POST') {
      return json({
        auth_enabled: true,
        logged_in: false,
        password_set: true,
        password_changeable: true,
        setup_state: 'enabled',
      })
    }

    if (pathname === '/api/v1/auth/login' && method === 'POST') {
      return json({ success: true })
    }

    if (pathname === '/api/v1/auth/change-password' && method === 'POST') {
      return json({ success: true })
    }

    return json({ error: 'mock_not_found', path: pathname, method }, 404)
  })
}

async function clearOverlay(page) {
  await page.evaluate(() => {
    const existing = document.getElementById('__manual_annotation_overlay__')
    if (existing) existing.remove()
  })
}

async function annotateAndCapture(page, fileName, marks) {
  const boxes = []
  for (const mark of marks) {
    const target = mark.locator.first()
    await target.waitFor({ state: 'visible', timeout: 15_000 })
    await target.scrollIntoViewIfNeeded()
    const box = await target.boundingBox()
    if (!box) continue
    const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))
    boxes.push({
      x: box.x + scroll.x,
      y: box.y + scroll.y,
      width: box.width,
      height: box.height,
      label: mark.label,
    })
  }

  const finalScroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))

  await page.evaluate(({ elements, scrollOffset }) => {
    const old = document.getElementById('__manual_annotation_overlay__')
    if (old) old.remove()

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
    const intersects = (left, right, padding = 0) =>
      left.x < right.x + right.width + padding &&
      left.x + left.width > right.x - padding &&
      left.y < right.y + right.height + padding &&
      left.y + left.height > right.y - padding
    const overlapArea = (left, right, padding = 0) => {
      const x = Math.max(0, Math.min(left.x + left.width, right.x + right.width + padding) - Math.max(left.x, right.x - padding))
      const y = Math.max(0, Math.min(left.y + left.height, right.y + right.height + padding) - Math.max(left.y, right.y - padding))
      return x * y
    }
    const pointOnRectEdge = (rect, target) => {
      const cx = rect.x + rect.width / 2
      const cy = rect.y + rect.height / 2
      const dx = target.x - cx
      const dy = target.y - cy

      if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
        return { x: cx, y: cy }
      }

      const tx = Math.abs(dx) < 0.001 ? Number.POSITIVE_INFINITY : rect.width / 2 / Math.abs(dx)
      const ty = Math.abs(dy) < 0.001 ? Number.POSITIVE_INFINITY : rect.height / 2 / Math.abs(dy)
      const t = Math.min(tx, ty)

      return {
        x: cx + dx * t,
        y: cy + dy * t,
      }
    }

    const margin = window.innerWidth < 500 ? 8 : 6
    const labelMaxWidth = window.innerWidth < 500 ? 132 : 200

    const normalized = elements.map((item) => ({
      x: item.x - scrollOffset.x,
      y: item.y - scrollOffset.y,
      width: Math.max(item.width, 12),
      height: Math.max(item.height, 12),
      label: item.label,
    }))

    const overlay = document.createElement('div')
    overlay.id = '__manual_annotation_overlay__'
    overlay.style.position = 'fixed'
    overlay.style.inset = '0'
    overlay.style.pointerEvents = 'none'
    overlay.style.zIndex = '2147483647'
    const boxLayer = document.createElement('div')
    const lineLayer = document.createElement('div')
    const labelLayer = document.createElement('div')
    overlay.appendChild(boxLayer)
    overlay.appendChild(lineLayer)
    overlay.appendChild(labelLayer)
    document.body.appendChild(overlay)

    normalized.forEach((item) => {
      const box = document.createElement('div')
      box.style.position = 'fixed'
      box.style.left = `${Math.max(item.x - 3, 0)}px`
      box.style.top = `${Math.max(item.y - 3, 0)}px`
      box.style.width = `${Math.max(item.width + 6, 12)}px`
      box.style.height = `${Math.max(item.height + 6, 12)}px`
      box.style.border = '3px solid #ff3b30'
      box.style.borderRadius = '8px'
      box.style.boxSizing = 'border-box'
      boxLayer.appendChild(box)
    })

    const placedLabelRects = []
    const callouts = []

    normalized.forEach((item, index) => {
      const label = document.createElement('div')
      label.textContent = item.label
      label.style.position = 'fixed'
      label.style.left = '0px'
      label.style.top = '0px'
      label.style.padding = '3px 8px'
      label.style.maxWidth = `${labelMaxWidth}px`
      label.style.whiteSpace = 'normal'
      label.style.wordBreak = 'break-word'
      label.style.background = '#ff3b30'
      label.style.color = '#fff'
      label.style.fontSize = '12px'
      label.style.lineHeight = '1.35'
      label.style.fontWeight = '700'
      label.style.borderRadius = '6px'
      label.style.boxShadow = '0 2px 8px rgba(255,59,48,0.45)'
      label.style.visibility = 'hidden'
      labelLayer.appendChild(label)

      const labelWidth = Math.ceil(label.offsetWidth)
      const labelHeight = Math.ceil(label.offsetHeight)
      const gap = window.innerWidth < 500 ? 6 : 8
      const baseCandidates = [
        { x: item.x, y: item.y - labelHeight - gap },
        { x: item.x + item.width - labelWidth, y: item.y - labelHeight - gap },
        { x: item.x, y: item.y + item.height + gap },
        { x: item.x + item.width - labelWidth, y: item.y + item.height + gap },
        { x: item.x + item.width + gap, y: item.y + item.height / 2 - labelHeight / 2 },
        { x: item.x - labelWidth - gap, y: item.y + item.height / 2 - labelHeight / 2 },
        { x: item.x + item.width / 2 - labelWidth / 2, y: item.y - labelHeight - gap },
        { x: item.x + item.width / 2 - labelWidth / 2, y: item.y + item.height + gap },
      ]
      const railY = margin + index * (labelHeight + gap)
      const candidates = [
        ...baseCandidates,
        { x: margin, y: railY },
        { x: window.innerWidth - labelWidth - margin, y: railY },
      ].map((candidate) => ({
        x: clamp(candidate.x, margin, Math.max(window.innerWidth - labelWidth - margin, margin)),
        y: clamp(candidate.y, margin, Math.max(window.innerHeight - labelHeight - margin, margin)),
        width: labelWidth,
        height: labelHeight,
      }))

      let selected = candidates[0]
      let selectedScore = Number.POSITIVE_INFINITY

      candidates.forEach((candidate) => {
        let score = 0

        placedLabelRects.forEach((other) => {
          if (intersects(candidate, other, 4)) {
            score += 8_000 + overlapArea(candidate, other, 4)
          }
        })

        normalized.forEach((box) => {
          if (!intersects(candidate, box, 3)) return
          const penalty = box === item ? 14_000 : 10_000
          score += penalty + overlapArea(candidate, box, 3) * 2.5
        })

        const candidateCenter = {
          x: candidate.x + candidate.width / 2,
          y: candidate.y + candidate.height / 2,
        }
        const boxCenter = {
          x: item.x + item.width / 2,
          y: item.y + item.height / 2,
        }
        score += Math.hypot(candidateCenter.x - boxCenter.x, candidateCenter.y - boxCenter.y) * 0.8

        if (score < selectedScore) {
          selectedScore = score
          selected = candidate
        }
      })

      label.style.left = `${selected.x}px`
      label.style.top = `${selected.y}px`
      label.style.visibility = 'visible'
      placedLabelRects.push(selected)
      callouts.push({
        box: item,
        label: selected,
      })
    })

    callouts.forEach((callout) => {
      const labelCenter = {
        x: callout.label.x + callout.label.width / 2,
        y: callout.label.y + callout.label.height / 2,
      }
      const boxCenter = {
        x: callout.box.x + callout.box.width / 2,
        y: callout.box.y + callout.box.height / 2,
      }
      const start = pointOnRectEdge(callout.label, boxCenter)
      const end = pointOnRectEdge(callout.box, labelCenter)
      const length = Math.hypot(end.x - start.x, end.y - start.y)
      if (length < 6) return

      const angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI

      const line = document.createElement('div')
      line.style.position = 'fixed'
      line.style.left = `${start.x}px`
      line.style.top = `${start.y}px`
      line.style.width = `${length}px`
      line.style.height = '2px'
      line.style.background = 'rgba(255,59,48,0.82)'
      line.style.transform = `rotate(${angle}deg)`
      line.style.transformOrigin = '0 0'
      lineLayer.appendChild(line)

      const arrow = document.createElement('div')
      arrow.style.position = 'fixed'
      arrow.style.left = `${end.x - 4}px`
      arrow.style.top = `${end.y - 5}px`
      arrow.style.width = '0'
      arrow.style.height = '0'
      arrow.style.borderTop = '5px solid transparent'
      arrow.style.borderBottom = '5px solid transparent'
      arrow.style.borderLeft = '8px solid #ff3b30'
      arrow.style.transform = `rotate(${angle}deg)`
      arrow.style.transformOrigin = '50% 50%'
      lineLayer.appendChild(arrow)
    })
  }, { elements: boxes, scrollOffset: finalScroll })

  await page.waitForTimeout(160)
  await page.screenshot({ path: path.join(outputDir, fileName), fullPage: false })
  await clearOverlay(page)
  console.log(`saved: ${fileName}`)
}

async function captureDesktopFlow(page) {
  await page.setViewportSize({ width: 1600, height: 980 })

  await page.goto('http://127.0.0.1:4174/')
  await page.getByTestId('page-dashboard').waitFor()

  await annotateAndCapture(page, '01-shell-desktop-navigation.png', [
    { locator: page.getByTestId('desktop-nav-分析'), label: '主导航：分析台' },
    { locator: page.getByTestId('desktop-nav-问股'), label: '主导航：问股' },
    { locator: page.getByTestId('desktop-nav-持仓'), label: '主导航：持仓' },
    { locator: page.getByTestId('desktop-nav-回测'), label: '主导航：回测' },
    { locator: page.getByTestId('desktop-nav-设置'), label: '主导航：设置' },
  ])

  await page.getByLabel('股票代码').fill('600519')
  await page.getByRole('button', { name: '提交分析' }).click()
  await page.getByText(/分析任务已提交/).waitFor()
  await annotateAndCapture(page, '02-dashboard-submit-analysis.png', [
    { locator: page.locator('input[aria-label="股票代码"]'), label: '输入股票代码/名称' },
    { locator: page.locator('input[name="notify"]'), label: '通知开关' },
    { locator: page.getByRole('button', { name: /提交分析|提交中/ }), label: '提交分析按钮' },
    { locator: page.getByText(/分析任务已提交/), label: '提交结果提示' },
  ])

  await annotateAndCapture(page, '03-dashboard-history-and-actions.png', [
    { locator: page.getByTestId('task-panel'), label: '任务状态面板' },
    { locator: page.getByTestId('history-panel'), label: '历史分析列表' },
    { locator: page.getByRole('button', { name: '复制摘要' }), label: '复制摘要' },
    { locator: page.getByRole('button', { name: '追问 AI' }), label: '追问 AI' },
  ])

  await page.getByTestId('report-tab-markdown').click()
  await page.getByTestId('report-tab-content-markdown').waitFor()
  await annotateAndCapture(page, '04-dashboard-markdown-tab.png', [
    { locator: page.getByTestId('report-tab-markdown'), label: 'Markdown 标签' },
    { locator: page.getByTestId('report-tab-content-markdown'), label: 'Markdown 内容区' },
  ])

  await page.getByRole('button', { name: '追问 AI' }).click()
  await page.getByTestId('page-chat').waitFor()
  await annotateAndCapture(page, '05-chat-context-and-input.png', [
    { locator: page.getByTestId('chat-follow-up-banner'), label: '分析台上下文已注入' },
    { locator: page.getByTestId('chat-skill-select'), label: '策略选择器' },
    { locator: page.getByTestId('chat-input'), label: '提问输入框' },
    { locator: page.getByTestId('chat-send-message'), label: '发送提问' },
  ])

  await page.getByTestId('chat-skill-select').selectOption('chan_theory')
  await page.getByTestId('chat-input').fill('请给我一个短线计划')
  await page.getByTestId('chat-send-message').click()
  await page.getByTestId('chat-stream-panel').waitFor()
  await page.getByText(/思考过程/).first().click()
  await page.getByText('消息已发送，AI 回复已更新。').waitFor()
  await annotateAndCapture(page, '06-chat-stream-timeline.png', [
    { locator: page.getByTestId('chat-stream-panel'), label: '流式状态面板' },
    { locator: page.getByTestId('chat-stream-status'), label: '流式状态' },
    { locator: page.getByText('消息已发送，AI 回复已更新。'), label: '发送成功反馈' },
    { locator: page.getByTestId('chat-composer'), label: '连续提问输入区' },
  ])

  await annotateAndCapture(page, '07-chat-session-operations.png', [
    { locator: page.getByTestId('chat-new-session'), label: '新建会话' },
    { locator: page.getByTestId('chat-export-session'), label: '导出 Markdown' },
    { locator: page.getByTestId('chat-send-session'), label: '发送会话内容' },
    { locator: page.getByTestId('chat-session-list'), label: '会话列表' },
  ])

  await page.goto('http://127.0.0.1:4174/portfolio')
  await page.getByTestId('page-portfolio').waitFor()
  await annotateAndCapture(page, '08-portfolio-overview-and-protection.png', [
    { locator: page.getByTestId('portfolio-account-select'), label: '账户选择' },
    { locator: page.getByTestId('portfolio-cost-method'), label: '成本法选择' },
    { locator: page.getByTestId('portfolio-write-protection'), label: '全部账户禁写提示' },
    { locator: page.getByTestId('portfolio-tab-overview'), label: '总览标签' },
  ])

  await page.getByTestId('portfolio-account-select').selectOption('1')
  await page.getByTestId('portfolio-tab-entry').click()
  await page.getByPlaceholder('股票代码').first().fill('600519')
  await page.getByPlaceholder('数量').fill('100')
  await page.getByPlaceholder('价格').fill('1820')
  await annotateAndCapture(page, '09-portfolio-entry-form.png', [
    { locator: page.getByTestId('portfolio-tab-entry'), label: '手工录入标签' },
    { locator: page.getByPlaceholder('股票代码').first(), label: '股票代码输入' },
    { locator: page.getByPlaceholder('数量'), label: '数量输入' },
    { locator: page.getByTestId('portfolio-entry-submit-trade'), label: '提交交易流水' },
  ])

  await page.getByTestId('portfolio-tab-import').click()
  await page.getByTestId('portfolio-import-file').setInputFiles({
    name: 'demo.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('date,code,side,qty,price\n2026-03-26,600519,buy,100,1820\n'),
  })
  await annotateAndCapture(page, '10-portfolio-import-flow.png', [
    { locator: page.getByTestId('portfolio-tab-import'), label: 'CSV 导入标签' },
    { locator: page.getByTestId('portfolio-import-broker'), label: '券商格式选择' },
    { locator: page.locator('label', { hasText: '选择文件：' }), label: 'CSV 文件选择' },
    { locator: page.getByTestId('portfolio-import-parse'), label: '解析文件' },
    { locator: page.getByTestId('portfolio-import-commit'), label: '提交导入' },
  ])

  await page.getByTestId('portfolio-tab-events').click()
  await annotateAndCapture(page, '11-portfolio-events-management.png', [
    { locator: page.getByTestId('portfolio-tab-events'), label: '流水与修正标签' },
    { locator: page.getByTestId('portfolio-events-type'), label: '流水类型筛选' },
    { locator: page.getByTestId('portfolio-events-refresh'), label: '刷新流水' },
    { locator: page.getByTestId('portfolio-events-list'), label: '流水列表' },
  ])

  await page.goto('http://127.0.0.1:4174/backtest')
  await page.getByTestId('page-backtest').waitFor()
  await annotateAndCapture(page, '12-backtest-controls.png', [
    { locator: page.getByTestId('backtest-code-input'), label: '股票代码筛选' },
    { locator: page.getByTestId('backtest-window-input'), label: '评估窗口' },
    { locator: page.getByTestId('backtest-filter-submit'), label: '应用筛选' },
    { locator: page.getByTestId('backtest-run-submit'), label: '运行回测' },
  ])

  await page.getByTestId('backtest-run-submit').click()
  await page.getByTestId('backtest-run-summary').waitFor()
  await annotateAndCapture(page, '13-backtest-results-and-kpi.png', [
    { locator: page.getByTestId('backtest-run-summary'), label: '运行结果摘要' },
    { locator: page.getByTestId('backtest-kpi-accuracy'), label: 'KPI：方向准确率' },
    { locator: page.getByTestId('backtest-chart-overall'), label: '全局趋势图' },
    { locator: page.getByTestId('backtest-results-table'), label: '回测结果表格' },
  ])

  await page.goto('http://127.0.0.1:4174/settings')
  await page.getByTestId('page-settings').waitFor()
  await page.getByTestId('settings-category-ai_model').click()
  await page.locator('[data-testid="settings-field-OPENAI_MODEL"] input').fill('gpt-5')
  await page.getByTestId('settings-save-bar').waitFor()
  await annotateAndCapture(page, '14-settings-config-save.png', [
    { locator: page.getByTestId('settings-search'), label: '配置搜索' },
    { locator: page.getByTestId('settings-category-ai_model'), label: '分类导航' },
    { locator: page.getByTestId('settings-field-OPENAI_MODEL'), label: '配置项编辑区' },
    { locator: page.getByTestId('settings-save'), label: '保存配置' },
    { locator: page.getByTestId('settings-save-bar'), label: '脏数据保存条' },
  ])

  await page.getByTestId('settings-save').click()
  await page.getByText(/配置已保存/).waitFor()
  await annotateAndCapture(page, '15-settings-auth-env-tools.png', [
    { locator: page.locator('label', { has: page.getByTestId('settings-auth-toggle') }), label: '认证开关' },
    { locator: page.getByRole('button', { name: '保存认证设置' }), label: '保存认证设置' },
    { locator: page.getByRole('button', { name: '导出 .env' }), label: '导出 .env' },
    { locator: page.getByRole('button', { name: '导入 .env' }), label: '导入 .env' },
    { locator: page.getByRole('button', { name: '测试渠道' }), label: '测试 LLM 渠道' },
  ])

  await page.goto('http://127.0.0.1:4174/login')
  await page.getByTestId('page-login').waitFor()
  await annotateAndCapture(page, '16-login-page.png', [
    { locator: page.getByTestId('login-status'), label: '认证状态提示' },
    { locator: page.getByTestId('login-password'), label: '密码输入框' },
    { locator: page.getByTestId('login-submit'), label: '登录按钮' },
  ])
}

async function captureMobileFlow(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'zh-CN',
  })
  const page = await context.newPage()
  await setupMockApi(page)

  await page.goto('http://127.0.0.1:4174/')
  await page.getByTestId('page-dashboard').waitFor()
  await annotateAndCapture(page, '17-mobile-navigation.png', [
    { locator: page.getByTestId('mobile-tab-分析'), label: '分析' },
    { locator: page.getByTestId('mobile-tab-问股'), label: '问股' },
    { locator: page.getByTestId('mobile-tab-持仓'), label: '持仓' },
    { locator: page.getByTestId('mobile-tab-设置'), label: '设置' },
    { locator: page.getByTestId('mobile-view-switcher'), label: '双视图切换' },
  ])

  await page.goto('http://127.0.0.1:4174/chat')
  await page.getByTestId('page-chat').waitFor()
  await annotateAndCapture(page, '18-mobile-chat-switcher.png', [
    { locator: page.getByTestId('chat-mobile-switcher'), label: '双面板切换' },
    { locator: page.getByTestId('chat-mobile-pane-sessions'), label: '会话面板' },
    { locator: page.getByTestId('chat-mobile-pane-messages'), label: '消息面板' },
    { locator: page.getByTestId('chat-send-message'), label: '发送按钮' },
  ])

  await context.close()
}

async function main() {
  await fs.rm(outputDir, { recursive: true, force: true })
  await fs.mkdir(outputDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1600, height: 980 },
    locale: 'zh-CN',
  })
  const page = await context.newPage()
  await setupMockApi(page)

  try {
    await captureDesktopFlow(page)
    await captureMobileFlow(browser)
  } finally {
    await context.close()
    await browser.close()
  }

  console.log(`done: ${outputDir}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
