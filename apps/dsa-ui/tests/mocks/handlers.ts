import { http, HttpResponse } from 'msw'

const mockPortfolioAccounts = [
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
]

const mockPortfolioTrades = [
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
]

const mockPortfolioCashLedgers = [
  {
    id: 401,
    account_id: 1,
    event_date: '2026-03-18',
    direction: 'in',
    amount: 50000,
    currency: 'CNY',
  },
]

const mockPortfolioCorporateActions = [
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
]

const mockBacktestItems = [
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
  },
  {
    analysis_history_id: 9003,
    code: '600519',
    analysis_date: '2026-03-12',
    eval_window_days: 10,
    engine_version: 'v1',
    eval_status: 'insufficient',
    operation_advice: '等待',
    outcome: 'loss',
    simulated_return_pct: -2.2,
  },
]

const mockSystemConfigItems = [
  {
    key: 'ENABLE_NOTIFY',
    value: 'true',
    raw_value_exists: true,
    is_masked: false,
    schema: {
      key: 'ENABLE_NOTIFY',
      title: '通知开关',
      description: '是否开启通知发送',
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
    key: 'ADMIN_AUTH_ENABLED',
    value: 'true',
    raw_value_exists: true,
    is_masked: false,
    schema: {
      key: 'ADMIN_AUTH_ENABLED',
      title: '启用认证',
      description: '是否开启管理员认证',
      category: 'system',
      data_type: 'boolean',
      ui_control: 'switch',
      is_sensitive: false,
      is_required: false,
      is_editable: true,
      options: [],
      validation: {},
      display_order: 30,
    },
  },
  {
    key: 'STOCK_LIST',
    value: '600519,AAPL',
    raw_value_exists: true,
    is_masked: false,
    schema: {
      key: 'STOCK_LIST',
      title: '关注股票',
      description: '默认股票池',
      category: 'base',
      data_type: 'string',
      ui_control: 'textarea',
      is_sensitive: false,
      is_required: false,
      is_editable: true,
      options: [],
      validation: {},
      display_order: 1,
    },
  },
]

let mockAuthUsers = [
  {
    id: 1,
    username: 'admin',
    display_name: 'Admin',
    email: 'admin@example.com',
    status: 'active',
    is_system_admin: true,
    created_at: '2026-03-20T09:00:00+08:00',
  },
  {
    id: 2,
    username: 'demo_user',
    display_name: 'Demo User',
    email: 'demo@example.com',
    status: 'active',
    is_system_admin: false,
    created_at: '2026-03-21T09:00:00+08:00',
  },
]

export const handlers = [
  http.get('/api/v1/health', () => HttpResponse.json({ ok: true })),
  http.get('/api/v1/agent/skills', () =>
    HttpResponse.json({
      default_skill_id: 'bull_trend',
      skills: [
        {
          id: 'bull_trend',
          name: '趋势策略',
          description: '适合顺势行情，关注均线与量价结构。',
        },
        {
          id: 'chan_theory',
          name: '缠论',
          description: '关注中枢与笔段结构，适合节奏研判。',
        },
        {
          id: 'wave_theory',
          name: '波浪理论',
          description: '关注主升浪与调整浪结构。',
        },
      ],
    }),
  ),
  http.post('/api/v1/agent/chat', async ({ request }) => {
    const body = (await request.json()) as {
      message?: string
      session_id?: string
    }
    return HttpResponse.json({
      success: true,
      content: `已收到：${String(body.message || '')}`,
      session_id: String(body.session_id || 'mock-session-id'),
    })
  }),
  http.post('/api/v1/agent/chat/stream', async ({ request }) => {
    const body = (await request.json()) as {
      message?: string
      session_id?: string
      context?: Record<string, unknown>
    }
    const question = String(body.message || '')
    const sessionId = String(body.session_id || 'mock-session-id')
    const stockCode =
      typeof body.context?.stock_code === 'string'
        ? String(body.context.stock_code)
        : '未指定代码'
    const streamPayload = [
      {
        type: 'thinking',
        step: 1,
        message: '正在制定分析路径...',
      },
      {
        type: 'tool_start',
        step: 1,
        tool: 'get_realtime_quote',
        display_name: '获取实时行情',
      },
      {
        type: 'tool_done',
        step: 1,
        tool: 'get_realtime_quote',
        display_name: '获取实时行情',
        success: true,
        duration: 0.42,
      },
      {
        type: 'done',
        success: true,
        content: `**追问目标**：${stockCode}\n\n- 问题：${question}\n- 结论：建议结合量价信号分批执行。`,
        session_id: sessionId,
        total_steps: 2,
      },
    ]
      .map((event) => `data: ${JSON.stringify(event)}\n\n`)
      .join('')

    return new HttpResponse(streamPayload, {
      headers: {
        'Content-Type': 'text/event-stream',
      },
    })
  }),
  http.get('/api/v1/agent/chat/sessions', () =>
    HttpResponse.json({
      sessions: [
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
      ],
    }),
  ),
  http.get('/api/v1/agent/chat/sessions/:sessionId', ({ params }) => {
    const sessionId = String(params.sessionId || '')
    if (sessionId === 'session-001') {
      return HttpResponse.json({
        session_id: sessionId,
        messages: [
          {
            id: 'm-001',
            role: 'user',
            content: '请分析贵州茅台的短线趋势',
            created_at: '2026-03-26T09:10:01+08:00',
          },
          {
            id: 'm-002',
            role: 'assistant',
            content: '短线仍偏强，但建议关注回踩确认。',
            created_at: '2026-03-26T09:10:05+08:00',
          },
        ],
      })
    }

    if (sessionId === 'session-002') {
      return HttpResponse.json({
        session_id: sessionId,
        messages: [
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
      })
    }

    return HttpResponse.json({
      session_id: sessionId,
      messages: [],
    })
  }),
  http.delete('/api/v1/agent/chat/sessions/:sessionId', ({ params }) => {
    const sessionId = String(params.sessionId || '')
    if (sessionId === 'session-001' || sessionId === 'session-002') {
      return HttpResponse.json({ deleted: 1 })
    }
    return HttpResponse.json({ deleted: 0 })
  }),
  http.post('/api/v1/agent/chat/send', () =>
    HttpResponse.json({
      success: true,
    }),
  ),
  http.get('/api/v1/analysis/tasks', () =>
    HttpResponse.json({
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
    }),
  ),
  http.post('/api/v1/analysis/analyze', () =>
    HttpResponse.json(
      {
        task_id: 'task-mock-001',
        status: 'pending',
      },
      { status: 202 },
    ),
  ),
  http.get('/api/v1/history', () =>
    HttpResponse.json({
      total: 1,
      page: 1,
      limit: 8,
      items: [
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
      ],
    }),
  ),
  http.delete('/api/v1/history', () => HttpResponse.json({ deleted: 1 })),
  http.get('/api/v1/history/:recordId', ({ params }) => {
    const recordId = Number(params.recordId)
    if (recordId === 101) {
      return HttpResponse.json({
        meta: {
          id: 101,
          query_id: 'q-mock-101',
          stock_code: '600519',
          stock_name: '贵州茅台',
          report_type: 'detailed',
          report_language: 'zh',
          model_used: 'openai/gpt-5.4',
          created_at: '2026-03-26T09:30:00+08:00',
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
            data_sources: 'mock:msw',
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
      })
    }

    return HttpResponse.json(
      {
        error: 'not_found',
        message: '记录不存在',
      },
      { status: 404 },
    )
  }),
  http.get('/api/v1/history/:recordId/news', ({ params }) => {
    const recordId = Number(params.recordId)
    if (recordId === 101) {
      return HttpResponse.json({
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
      })
    }
    return HttpResponse.json({ total: 0, items: [] })
  }),
  http.get('/api/v1/history/:recordId/markdown', ({ params }) => {
    const recordId = Number(params.recordId)
    if (recordId === 101) {
      return HttpResponse.json({ content: '# 贵州茅台\n\n- 观点：继续观察回踩后的承接力度。' })
    }
    return HttpResponse.json({ content: '' })
  }),
  http.get('/api/v1/portfolio/accounts', () =>
    HttpResponse.json({
      accounts: mockPortfolioAccounts,
    }),
  ),
  http.post('/api/v1/portfolio/accounts', async ({ request }) => {
    const body = (await request.json()) as { name?: string; market?: string; base_currency?: string; broker?: string }
    return HttpResponse.json({
      id: 3,
      owner_id: 'demo-user',
      name: body.name || '新账户',
      broker: body.broker || 'Demo',
      market: body.market || 'cn',
      base_currency: body.base_currency || 'CNY',
      is_active: true,
    })
  }),
  http.get('/api/v1/portfolio/snapshot', () =>
    HttpResponse.json({
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
    }),
  ),
  http.get('/api/v1/portfolio/risk', () =>
    HttpResponse.json({
      as_of: '2026-03-26',
      account_id: null,
      cost_method: 'fifo',
      currency: 'CNY',
      thresholds: {},
      concentration: {
        total_market_value: 210000,
        top_weight_pct: 42.5,
        alert: false,
        top_positions: [
          { symbol: '600519', market_value_base: 182000, weight_pct: 42.5, is_alert: false },
          { symbol: 'AAPL', market_value_base: 28000, weight_pct: 12.0, is_alert: false },
        ],
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
    }),
  ),
  http.post('/api/v1/portfolio/fx/refresh', () =>
    HttpResponse.json({
      as_of: '2026-03-26',
      account_count: 2,
      pair_count: 3,
      updated_count: 3,
      stale_count: 0,
      error_count: 0,
      refresh_enabled: true,
      disabled_reason: null,
    }),
  ),
  http.post('/api/v1/portfolio/trades', () => HttpResponse.json({ id: 9001 })),
  http.post('/api/v1/portfolio/cash-ledger', () => HttpResponse.json({ id: 9002 })),
  http.post('/api/v1/portfolio/corporate-actions', () => HttpResponse.json({ id: 9003 })),
  http.delete('/api/v1/portfolio/trades/:tradeId', () => HttpResponse.json({ deleted: 1 })),
  http.delete('/api/v1/portfolio/cash-ledger/:entryId', () => HttpResponse.json({ deleted: 1 })),
  http.delete('/api/v1/portfolio/corporate-actions/:actionId', () => HttpResponse.json({ deleted: 1 })),
  http.get('/api/v1/portfolio/trades', ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') || '1')
    const pageSize = Number(url.searchParams.get('page_size') || '20')
    const start = (page - 1) * pageSize
    const items = mockPortfolioTrades.slice(start, start + pageSize)
    return HttpResponse.json({
      items,
      total: mockPortfolioTrades.length,
      page,
      page_size: pageSize,
    })
  }),
  http.get('/api/v1/portfolio/cash-ledger', ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') || '1')
    const pageSize = Number(url.searchParams.get('page_size') || '20')
    const start = (page - 1) * pageSize
    const items = mockPortfolioCashLedgers.slice(start, start + pageSize)
    return HttpResponse.json({
      items,
      total: mockPortfolioCashLedgers.length,
      page,
      page_size: pageSize,
    })
  }),
  http.get('/api/v1/portfolio/corporate-actions', ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') || '1')
    const pageSize = Number(url.searchParams.get('page_size') || '20')
    const start = (page - 1) * pageSize
    const items = mockPortfolioCorporateActions.slice(start, start + pageSize)
    return HttpResponse.json({
      items,
      total: mockPortfolioCorporateActions.length,
      page,
      page_size: pageSize,
    })
  }),
  http.get('/api/v1/portfolio/imports/csv/brokers', () =>
    HttpResponse.json({
      brokers: [
        { broker: 'huatai', aliases: ['ht'], display_name: '华泰' },
        { broker: 'citic', aliases: ['zx'], display_name: '中信' },
      ],
    }),
  ),
  http.post('/api/v1/portfolio/imports/csv/parse', () =>
    HttpResponse.json({
      broker: 'huatai',
      record_count: 3,
      skipped_count: 1,
      error_count: 0,
      records: [],
      errors: [],
    }),
  ),
  http.post('/api/v1/portfolio/imports/csv/commit', () =>
    HttpResponse.json({
      account_id: 1,
      record_count: 3,
      inserted_count: 2,
      duplicate_count: 1,
      failed_count: 0,
      dry_run: false,
      errors: [],
    }),
  ),
  http.post('/api/v1/backtest/run', () =>
    HttpResponse.json({
      processed: 3,
      saved: 3,
      completed: 2,
      insufficient: 1,
      errors: 0,
    }),
  ),
  http.get('/api/v1/backtest/results', ({ request }) => {
    const url = new URL(request.url)
    const code = (url.searchParams.get('code') || '').toUpperCase()
    const page = Number(url.searchParams.get('page') || '1')
    const limit = Number(url.searchParams.get('limit') || '20')

    const filtered = code ? mockBacktestItems.filter((item) => item.code === code) : mockBacktestItems
    const start = (page - 1) * limit
    const items = filtered.slice(start, start + limit)
    return HttpResponse.json({
      total: filtered.length,
      page,
      limit,
      items,
    })
  }),
  http.get('/api/v1/backtest/performance', () =>
    HttpResponse.json({
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
    }),
  ),
  http.get('/api/v1/backtest/performance/:code', ({ params }) =>
    HttpResponse.json({
      scope: 'stock',
      code: String(params.code || '600519').toUpperCase(),
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
    }),
  ),
  http.get('/api/v1/system/config', () =>
    HttpResponse.json({
      config_version: 'v-mock-1',
      mask_token: '******',
      items: mockSystemConfigItems,
      updated_at: '2026-03-26T10:00:00+08:00',
    }),
  ),
  http.get('/api/v1/system/config/schema', () =>
    HttpResponse.json({
      schema_version: 'mock-1',
      categories: [],
    }),
  ),
  http.post('/api/v1/system/config/validate', async ({ request }) => {
    const body = (await request.json()) as { items?: Array<{ key: string; value: string }> }
    const issues = (body.items || [])
      .filter((item) => item.key === 'OPENAI_MODEL' && !item.value.trim())
      .map((item) => ({
        key: item.key,
        code: 'required',
        message: '默认模型不能为空',
        severity: 'error',
      }))
    return HttpResponse.json({
      valid: issues.length === 0,
      issues,
    })
  }),
  http.put('/api/v1/system/config', async ({ request }) => {
    const body = (await request.json()) as { items?: Array<{ key: string }> }
    return HttpResponse.json({
      success: true,
      config_version: 'v-mock-2',
      applied_count: body.items?.length || 0,
      skipped_masked_count: 0,
      reload_triggered: true,
      updated_keys: (body.items || []).map((item) => item.key),
      warnings: [],
    })
  }),
  http.get('/api/v1/system/config/export', () =>
    HttpResponse.json({
      content: 'ENABLE_NOTIFY=true\nOPENAI_MODEL=gpt-4o-mini\n',
      config_version: 'v-mock-1',
    }),
  ),
  http.post('/api/v1/system/config/import', () =>
    HttpResponse.json({
      success: true,
      config_version: 'v-mock-3',
      applied_count: 2,
      skipped_masked_count: 0,
      reload_triggered: true,
      updated_keys: ['ENABLE_NOTIFY', 'OPENAI_MODEL'],
      warnings: [],
    }),
  ),
  http.post('/api/v1/system/config/llm/test-channel', async ({ request }) => {
    const body = (await request.json()) as { name?: string; protocol?: string; models?: string[] }
    return HttpResponse.json({
      success: true,
      message: `渠道 ${body.name || 'quick-test'} 测试成功`,
      error: null,
      resolved_protocol: body.protocol || 'openai',
      resolved_model: body.models?.[0] || 'gpt-4o-mini',
      latency_ms: 128,
    })
  }),
  http.get('/api/v1/auth/status', () =>
    HttpResponse.json({
      auth_enabled: true,
      logged_in: true,
      password_set: true,
      password_changeable: true,
      setup_state: 'enabled',
    }),
  ),
  http.get('/api/v1/auth/me', () =>
    HttpResponse.json({
      authenticated: true,
      auth_enabled: true,
      user: {
        id: 1,
        username: 'admin',
        display_name: 'Admin',
        email: 'admin@example.com',
        is_system_admin: true,
      },
      active_tenant: {
        id: 1,
        slug: 'default',
        name: 'Default Workspace',
        role: 'system_admin',
      },
      available_tenants: [
        {
          id: 1,
          slug: 'default',
          name: 'Default Workspace',
          role: 'system_admin',
        },
      ],
      capabilities: [
        'system.config.read',
        'system.config.write',
        'users.manage',
      ],
    }),
  ),
  http.post('/api/v1/auth/settings', async ({ request }) => {
    const body = (await request.json()) as { authEnabled?: boolean }
    return HttpResponse.json({
      auth_enabled: !!body.authEnabled,
      logged_in: true,
      password_set: true,
      password_changeable: true,
      setup_state: 'enabled',
    })
  }),
  http.post('/api/v1/auth/login', () => HttpResponse.json({ success: true })),
  http.post('/api/v1/auth/change-password', () => HttpResponse.json({ success: true })),
  http.post('/api/v1/auth/logout', () => HttpResponse.json({ success: true })),
  http.get('/api/v1/auth/users', () =>
    HttpResponse.json({
      users: mockAuthUsers,
    }),
  ),
  http.post('/api/v1/auth/users', async ({ request }) => {
    const body = (await request.json()) as {
      username?: string
      password?: string
      passwordConfirm?: string
      displayName?: string
      email?: string
      isSystemAdmin?: boolean
    }
    const username = String(body.username || '').trim().toLowerCase()
    const password = String(body.password || '')
    const passwordConfirm = String(body.passwordConfirm || '')
    if (!username) {
      return HttpResponse.json(
        { error: 'username_required', message: '请输入用户名' },
        { status: 400 },
      )
    }
    if (!password) {
      return HttpResponse.json(
        { error: 'password_required', message: '请输入密码' },
        { status: 400 },
      )
    }
    if (password !== passwordConfirm) {
      return HttpResponse.json(
        { error: 'password_mismatch', message: '两次输入的密码不一致' },
        { status: 400 },
      )
    }
    if (mockAuthUsers.some((item) => item.username === username)) {
      return HttpResponse.json(
        { error: 'invalid_user', message: '用户名已存在' },
        { status: 400 },
      )
    }

    const created = {
      id: Math.max(...mockAuthUsers.map((item) => item.id)) + 1,
      username,
      display_name: String(body.displayName || '').trim() || username,
      email: String(body.email || '').trim(),
      status: 'active',
      is_system_admin: Boolean(body.isSystemAdmin),
      created_at: '2026-03-28T12:00:00+08:00',
    }
    mockAuthUsers = [...mockAuthUsers, created]
    return HttpResponse.json({ user: created })
  }),
  http.post('/api/v1/auth/users/:userId/reset-password', ({ params }) => {
    const userId = Number(params.userId)
    const exists = mockAuthUsers.some((item) => item.id === userId)
    if (!exists) {
      return HttpResponse.json(
        { error: 'invalid_user', message: '用户不存在' },
        { status: 404 },
      )
    }
    return HttpResponse.json({ ok: true })
  }),
  http.delete('/api/v1/auth/users/:userId', ({ params }) => {
    const userId = Number(params.userId)
    if (userId === 1) {
      return HttpResponse.json(
        { error: 'invalid_user', message: '不能删除当前登录账号' },
        { status: 400 },
      )
    }
    const before = mockAuthUsers.length
    mockAuthUsers = mockAuthUsers.filter((item) => item.id !== userId)
    if (mockAuthUsers.length === before) {
      return HttpResponse.json(
        { error: 'invalid_user', message: '用户不存在' },
        { status: 404 },
      )
    }
    return HttpResponse.json({ deleted: 1 })
  }),
  http.post('/api/v1/auth/users/:userId/delete', ({ params }) => {
    const userId = Number(params.userId)
    if (userId === 1) {
      return HttpResponse.json(
        { error: 'invalid_user', message: '不能删除当前登录账号' },
        { status: 400 },
      )
    }
    const before = mockAuthUsers.length
    mockAuthUsers = mockAuthUsers.filter((item) => item.id !== userId)
    if (mockAuthUsers.length === before) {
      return HttpResponse.json(
        { error: 'invalid_user', message: '用户不存在' },
        { status: 404 },
      )
    }
    return HttpResponse.json({ deleted: 1 })
  }),
]
