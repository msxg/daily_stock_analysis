import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', (route) => {
    const request = route.request()
    const { pathname } = new URL(request.url())

    if (pathname === '/api/v1/auth/status') {
      return route.fulfill({
        json: {
          auth_enabled: true,
          logged_in: true,
          password_set: true,
          password_changeable: true,
          setup_state: 'enabled',
        },
      })
    }

    if (pathname === '/api/v1/agent/skills') {
      return route.fulfill({
        json: {
          default_skill_id: 'bull_trend',
          skills: [
            { id: 'bull_trend', name: '多头趋势', description: '识别多头排列与趋势延续。' },
            { id: 'chan_theory', name: '缠论', description: '基于中枢结构识别买卖点。' },
            { id: 'wave_theory', name: '波浪理论', description: '结合波段节奏评估拐点。' },
          ],
        },
      })
    }

    if (pathname === '/api/v1/agent/chat/sessions') {
      return route.fulfill({
        json: {
          sessions: [],
        },
      })
    }

    if (pathname.startsWith('/api/v1/agent/chat/sessions/')) {
      return route.fulfill({
        json: {
          session_id: pathname.replace('/api/v1/agent/chat/sessions/', ''),
          messages: [],
        },
      })
    }

    if (pathname === '/api/v1/analysis/tasks') {
      return route.fulfill({
        json: {
          total: 0,
          pending: 0,
          processing: 0,
          tasks: [],
        },
      })
    }

    if (pathname === '/api/v1/history') {
      return route.fulfill({
        json: {
          total: 0,
          page: 1,
          limit: 20,
          items: [],
        },
      })
    }

    return route.fulfill({
      status: 200,
      json: {},
    })
  })
})

test('chat stream and context injection flow @visual', async ({ page }) => {
  await page.route('**/api/v1/agent/skills**', (route) =>
    route.fulfill({
      json: {
        default_skill_id: 'bull_trend',
        skills: [
          { id: 'bull_trend', name: '趋势策略', description: '趋势跟随' },
          { id: 'chan_theory', name: '缠论', description: '中枢结构分析' },
        ],
      },
    }),
  )
  await page.route('**/api/v1/agent/chat/sessions**', (route) =>
    route.fulfill({
      json: {
        sessions: [
          {
            session_id: 'session-001',
            title: '技术分析复盘',
            message_count: 2,
            created_at: '2026-03-26T09:10:00+08:00',
            last_active: '2026-03-26T09:20:00+08:00',
          },
        ],
      },
    }),
  )
  await page.route('**/api/v1/agent/chat/sessions/session-001**', (route) =>
    route.fulfill({
      json: {
        session_id: 'session-001',
        messages: [
          {
            id: 'm-001',
            role: 'assistant',
            content: '<think>先看趋势</think>\n\n**结论**：短线偏强。',
            created_at: '2026-03-26T09:10:05+08:00',
          },
        ],
      },
    }),
  )
  await page.route('**/api/v1/history/101**', (route) =>
    route.fulfill({
      json: {
        meta: {
          id: 101,
          query_id: 'q-101',
          stock_code: '600519',
          stock_name: '贵州茅台',
          report_type: 'detailed',
          created_at: '2026-03-26T09:30:00+08:00',
        },
        summary: {
          analysis_summary: '趋势偏多',
          operation_advice: '分批布局',
          trend_prediction: '偏强',
          sentiment_score: 68,
        },
      },
    }),
  )
  await page.route('**/api/v1/agent/chat/stream', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: [
        { type: 'thinking', step: 1, message: '正在制定分析路径...' },
        { type: 'tool_start', step: 1, tool: 'get_realtime_quote', display_name: '获取实时行情' },
        { type: 'tool_done', step: 1, tool: 'get_realtime_quote', display_name: '获取实时行情', success: true },
        { type: 'done', success: true, content: '建议分批布局并设置保护位。', session_id: 'session-001', total_steps: 2 },
      ]
        .map((event) => `data: ${JSON.stringify(event)}\n\n`)
        .join(''),
    }),
  )

  await page.goto('/chat?from=report&recordId=101')
  await expect(page.getByTestId('page-chat')).toBeVisible()
  await expect(page.getByTestId('chat-follow-up-banner')).toContainText('已注入追问上下文')

  await page.getByTestId('chat-input').fill('请给我一个短线计划')
  await page.getByTestId('chat-send-message').click()

  await expect(page.getByTestId('chat-stream-panel')).toBeVisible()
  await expect(page.getByTestId('chat-stream-event-0')).toContainText('正在制定分析路径')
  await expect(page.getByText('消息已发送，AI 回复已更新。')).toBeVisible()
})

test('portfolio and backtest workspace flows @visual', async ({ page }) => {
  await page.route('**/api/v1/portfolio/accounts**', (route) =>
    route.fulfill({
      json: {
        accounts: [{ id: 1, name: '主账户', market: 'cn', base_currency: 'CNY', is_active: true }],
      },
    }),
  )
  await page.route('**/api/v1/portfolio/snapshot**', (route) =>
    route.fulfill({
      json: {
        as_of: '2026-03-26',
        cost_method: 'fifo',
        currency: 'CNY',
        total_cash: 50000,
        total_market_value: 150000,
        total_equity: 200000,
        fx_stale: false,
        account_count: 1,
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
            realized_pnl: 0,
            unrealized_pnl: 0,
            fee_total: 0,
            tax_total: 0,
            fx_stale: false,
            positions: [],
          },
        ],
      },
    }),
  )
  await page.route('**/api/v1/portfolio/risk**', (route) =>
    route.fulfill({
      json: {
        as_of: '2026-03-26',
        cost_method: 'fifo',
        currency: 'CNY',
        concentration: { total_market_value: 150000, top_weight_pct: 35, alert: false, top_positions: [] },
        sector_concentration: { total_market_value: 150000, top_weight_pct: 35, alert: false, top_sectors: [], coverage: {}, errors: [] },
        drawdown: { series_points: 90, max_drawdown_pct: 6.2, current_drawdown_pct: 1.5, alert: false, fx_stale: false },
        stop_loss: { near_alert: false, triggered_count: 0, near_count: 0, items: [] },
        thresholds: {},
      },
    }),
  )
  await page.route('**/api/v1/portfolio/**', (route) => {
    const url = route.request().url()
    if (url.includes('/accounts') && route.request().method() === 'GET') {
      return route.fulfill({
        json: {
          accounts: [{ id: 1, name: '主账户', market: 'cn', base_currency: 'CNY', is_active: true }],
        },
      })
    }
    if (url.includes('/snapshot') && route.request().method() === 'GET') {
      return route.fulfill({
        json: {
          as_of: '2026-03-26',
          cost_method: 'fifo',
          currency: 'CNY',
          total_cash: 50000,
          total_market_value: 150000,
          total_equity: 200000,
          fx_stale: false,
          account_count: 1,
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
              realized_pnl: 0,
              unrealized_pnl: 0,
              fee_total: 0,
              tax_total: 0,
              fx_stale: false,
              positions: [],
            },
          ],
        },
      })
    }
    if (url.includes('/risk') && route.request().method() === 'GET') {
      return route.fulfill({
        json: {
          as_of: '2026-03-26',
          cost_method: 'fifo',
          currency: 'CNY',
          concentration: { total_market_value: 150000, top_weight_pct: 35, alert: false, top_positions: [] },
          sector_concentration: { total_market_value: 150000, top_weight_pct: 35, alert: false, top_sectors: [], coverage: {}, errors: [] },
          drawdown: { series_points: 90, max_drawdown_pct: 6.2, current_drawdown_pct: 1.5, alert: false, fx_stale: false },
          stop_loss: { near_alert: false, triggered_count: 0, near_count: 0, items: [] },
          thresholds: {},
        },
      })
    }
    if (url.includes('/trades') && route.request().method() === 'POST') {
      return route.fulfill({ json: { id: 1 } })
    }
    if (url.includes('/trades') && route.request().method() === 'GET') {
      return route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 20 } })
    }
    if (url.includes('/cash-ledger') && route.request().method() === 'GET') {
      return route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 20 } })
    }
    if (url.includes('/corporate-actions') && route.request().method() === 'GET') {
      return route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 20 } })
    }
    if (url.includes('/imports/csv/brokers')) {
      return route.fulfill({ json: { brokers: [{ broker: 'huatai', aliases: [], display_name: '华泰' }] } })
    }
    if (url.includes('/imports/csv/parse')) {
      return route.fulfill({ json: { broker: 'huatai', record_count: 1, skipped_count: 0, error_count: 0, records: [], errors: [] } })
    }
    if (url.includes('/fx/refresh')) {
      return route.fulfill({ json: { updated_count: 1, stale_count: 0, error_count: 0 } })
    }
    return route.continue()
  })

  await page.route('**/api/v1/backtest/results**', (route) =>
    route.fulfill({
      json: {
        total: 1,
        page: 1,
        limit: 20,
        items: [
          {
            analysis_history_id: 9001,
            code: '600519',
            analysis_date: '2026-03-10',
            eval_window_days: 10,
            engine_version: 'v1',
            eval_status: 'completed',
            operation_advice: '持有',
            outcome: 'win',
            simulated_return_pct: 3.6,
          },
        ],
      },
    }),
  )
  await page.route('**/api/v1/backtest/performance**', (route) =>
    route.fulfill({
      json: {
        scope: 'overall',
        eval_window_days: 10,
        engine_version: 'v1',
        total_evaluations: 1,
        completed_count: 1,
        insufficient_count: 0,
        long_count: 1,
        cash_count: 0,
        win_count: 1,
        loss_count: 0,
        neutral_count: 0,
        direction_accuracy_pct: 100,
        win_rate_pct: 100,
        avg_simulated_return_pct: 3.6,
        advice_breakdown: {},
        diagnostics: {},
      },
    }),
  )
  await page.route('**/api/v1/backtest/run', (route) =>
    route.fulfill({
      json: { processed: 1, saved: 1, completed: 1, insufficient: 0, errors: 0 },
    }),
  )

  await page.goto('/portfolio')
  await expect(page.getByTestId('page-portfolio')).toBeVisible()
  await expect(page.getByTestId('portfolio-write-protection')).toBeVisible()
  await expect(page.locator('[data-testid="portfolio-account-select"] option[value="1"]')).toHaveCount(1)
  await page.getByTestId('portfolio-account-select').selectOption('1')
  await expect(page.getByTestId('portfolio-tab-entry')).toBeVisible()

  await page.goto('/backtest')
  await expect(page.getByTestId('page-backtest')).toBeVisible()
  await page.getByTestId('backtest-run-submit').click()
  await expect(page.getByTestId('backtest-run-summary')).toBeVisible()
})

test('settings and login flows @visual', async ({ page }) => {
  let isLoggedIn = true

  await page.route('**/api/v1/system/config**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        json: {
          config_version: 'v1',
          mask_token: '******',
          items: [
            {
              key: 'OPENAI_MODEL',
              value: 'gpt-4o-mini',
              raw_value_exists: true,
              is_masked: false,
              schema: {
                key: 'OPENAI_MODEL',
                title: '默认模型',
                description: '',
                category: 'ai_model',
                data_type: 'string',
                ui_control: 'text',
                is_sensitive: false,
                is_required: true,
                is_editable: true,
                options: [],
                validation: {},
                display_order: 1,
              },
            },
          ],
        },
      })
    }
    return route.fulfill({
      json: {
        success: true,
        config_version: 'v2',
        applied_count: 1,
        skipped_masked_count: 0,
        reload_triggered: true,
        updated_keys: ['OPENAI_MODEL'],
        warnings: [],
      },
    })
  })
  await page.route('**/api/v1/system/config/validate', (route) => route.fulfill({ json: { valid: true, issues: [] } }))
  await page.route('**/api/v1/system/config/export', (route) =>
    route.fulfill({ json: { content: 'OPENAI_MODEL=gpt-4o-mini\n', config_version: 'v1' } }),
  )
  await page.route('**/api/v1/system/config/import', (route) =>
    route.fulfill({
      json: {
        success: true,
        config_version: 'v3',
        applied_count: 1,
        skipped_masked_count: 0,
        reload_triggered: true,
        updated_keys: ['OPENAI_MODEL'],
        warnings: [],
      },
    }),
  )
  await page.route('**/api/v1/system/config/llm/test-channel', (route) =>
    route.fulfill({
      json: {
        success: true,
        message: '测试成功',
        resolved_protocol: 'openai',
        resolved_model: 'gpt-4o-mini',
        latency_ms: 100,
      },
    }),
  )
  await page.route('**/api/v1/auth/status', (route) =>
    route.fulfill({
      json: {
        auth_enabled: true,
        logged_in: isLoggedIn,
        password_set: true,
        password_changeable: true,
        setup_state: 'enabled',
      },
    }),
  )
  await page.route('**/api/v1/auth/settings', (route) =>
    route.fulfill({
      json: {
        auth_enabled: true,
        logged_in: isLoggedIn,
        password_set: true,
        password_changeable: true,
        setup_state: 'enabled',
      },
    }),
  )
  await page.route('**/api/v1/auth/login', (route) => {
    isLoggedIn = true
    return route.fulfill({ json: { success: true } })
  })

  await page.goto('/settings')
  await expect(page.getByTestId('page-settings')).toBeVisible()
  await page.getByTestId('settings-category-ai_model').click()
  await page.locator('[data-testid="settings-field-OPENAI_MODEL"] input').fill('gpt-5')
  await page.getByTestId('settings-save').click()
  await expect(page.getByText(/配置已保存/)).toBeVisible()

  isLoggedIn = false
  await page.goto('/login')
  await expect(page.getByTestId('page-login')).toBeVisible()
  await page.getByTestId('login-password').fill('password-123')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('page-dashboard')).toBeVisible()
})
