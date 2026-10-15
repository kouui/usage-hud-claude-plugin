import { test, expect, mock } from 'claude-code/testing'

const PROPS = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100 }
const NOW = Date.parse('2026-10-15T00:00:00Z')

test('the band shows model, context and both plan windows', async ($, on) => {
  mock.clock(on, { now: NOW })
  on('session.model', () => ({ value: 'claude-sonnet-5-5' }))
  on('session.cwd', () => ({ value: 'D:\\share\\src\\game-dev-skills' }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { tokens: 62000, window: 200000, percent: 31 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 0, resetsAt: '2026-10-15T04:36:00Z' },
        { kind: 'seven_day', percentUsed: 91, resetsAt: '2026-10-16T20:00:00Z' },
      ],
      cost: { usd: 1.5 },
    },
  }))

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'usage-hud', surface, component: 'AbovePrompt', props: PROPS })
    expect(await ui.find({ type: 'Text', text: /Sonnet 5\.5/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /game-dev-skills/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /31%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /91%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Weekly/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /resets in 4h 36m/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /resets in 1d 20h/ })).toBeDefined()
    await ui.unmount()
  }
})

test('before the first response the context shows no figure', async ($, on) => {
  mock.clock(on, { now: NOW })
  on('session.model', () => ({ value: 'claude-sonnet-5-5' }))
  on('session.cwd', () => ({ value: '/home/u/proj' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))

  const ui = await $.ui.mount({ plugin: 'usage-hud', surface: 'terminal', component: 'AbovePrompt', props: PROPS })
  expect(await ui.find({ type: 'Text', text: /Context\s+--/ })).toBeDefined()
  await ui.unmount()
})
