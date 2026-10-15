import { test, expect, mock } from 'claude-code/testing'

const PROPS = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 200 }
const NOW = Date.parse('2026-10-15T00:00:00Z')

test('the band shows model, directory, bars with their labels and reset countdowns', async ($, on) => {
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
    expect(await ui.find({ key: 'context' })).toBeDefined()
    expect(await ui.find({ key: 'window-five_hour' })).toBeDefined()
    expect(await ui.find({ key: 'window-seven_day' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /\(4h 36m\)/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /\$1\.50/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /resets in/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('before the first response the context bar has no figure', async ($, on) => {
  mock.clock(on, { now: NOW })
  on('session.model', () => ({ value: 'claude-sonnet-5-5' }))
  on('session.cwd', () => ({ value: '/home/u/proj' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))

  const ui = await $.ui.mount({ plugin: 'usage-hud', surface: 'terminal', component: 'AbovePrompt', props: PROPS })
  expect(await ui.find({ key: 'context' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Context --/ })).toBeDefined()
  await ui.unmount()
})

test('a narrow band still draws every item', async ($, on) => {
  mock.clock(on, { now: NOW })
  on('session.model', () => ({ value: 'claude-sonnet-5-5' }))
  on('session.cwd', () => ({ value: '/home/u/proj' }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { tokens: 1000, window: 200000, percent: 1 },
      rateLimits: [{ kind: 'five_hour', percentUsed: 5, resetsAt: '2026-10-15T01:00:00Z' }],
    },
  }))

  for (const bodyColumns of [40, 300]) {
    const ui = await $.ui.mount({ plugin: 'usage-hud', surface: 'terminal', component: 'AbovePrompt', props: { ...PROPS, bodyColumns } })
    expect(await ui.find({ type: 'Text', text: /Sonnet 5\.5/ })).toBeDefined()
    expect(await ui.find({ key: 'context' })).toBeDefined()
    expect(await ui.find({ key: 'window-five_hour' })).toBeDefined()
    await ui.unmount()
  }
})

test('the context percent is measured against the compaction window and the bar shows message tokens', async ($, on) => {
  mock.clock(on, { now: NOW })
  on('session.model', () => ({ value: 'claude-sonnet-5-5' }))
  on('session.cwd', () => ({ value: '/home/u/proj' }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      // 100000 tokens of a 1M model window is 10%, but of a 400000 compaction window it is 25%
      context: {
        tokens: 100000,
        window: 1000000,
        percent: 10,
        breakdown: { rawMaxTokens: 400000, categories: [{ name: 'Messages', kind: 'used', tokens: 48000 }] },
      },
      rateLimits: [],
    },
  }))

  const ui = await $.ui.mount({ plugin: 'usage-hud', surface: 'terminal', component: 'AbovePrompt', props: PROPS })
  expect(await ui.find({ type: 'Text', text: /25%/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /\(msg 48k\/400k\)/ })).toBeDefined()
  await ui.unmount()
})

test('the cache figures of the last response are drawn on the right when showCache is on', { options: { showCache: true } }, async ($, on) => {
  mock.clock(on, { now: NOW })
  on('session.model', () => ({ value: 'claude-sonnet-5-5' }))
  on('session.cwd', () => ({ value: '/home/u/proj' }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: {
        tokens: 100000,
        window: 1000000,
        percent: 10,
        breakdown: {
          rawMaxTokens: 400000,
          categories: [{ name: 'Messages', kind: 'used', tokens: 48000 }],
          apiUsage: { input_tokens: 1000, output_tokens: 800, cache_read_input_tokens: 95000, cache_creation_input_tokens: 4000 },
        },
      },
      rateLimits: [],
    },
  }))

  for (const bodyColumns of [60, 140, 300]) {
    const ui = await $.ui.mount({ plugin: 'usage-hud', surface: 'terminal', component: 'AbovePrompt', props: { ...PROPS, bodyColumns } })
    expect(await ui.find({ key: 'cache' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /hit 95%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /cr 95k/ })).toBeDefined()
    await ui.unmount()
  }
})

test('without a response yet no cache group is drawn', { options: { showCache: true } }, async ($, on) => {
  mock.clock(on, { now: NOW })
  on('session.model', () => ({ value: 'claude-sonnet-5-5' }))
  on('session.cwd', () => ({ value: '/home/u/proj' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))

  const ui = await $.ui.mount({ plugin: 'usage-hud', surface: 'terminal', component: 'AbovePrompt', props: PROPS })
  expect(await ui.find({ key: 'cache' })).toBeUndefined()
  await ui.unmount()
})

test('the cache group is not drawn by default', async ($, on) => {
  mock.clock(on, { now: NOW })
  on('session.model', () => ({ value: 'claude-sonnet-5-5' }))
  on('session.cwd', () => ({ value: '/home/u/proj' }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: {
        tokens: 100000,
        window: 1000000,
        percent: 10,
        breakdown: {
          rawMaxTokens: 400000,
          categories: [{ name: 'Messages', kind: 'used', tokens: 48000 }],
          apiUsage: { input_tokens: 1000, output_tokens: 800, cache_read_input_tokens: 95000, cache_creation_input_tokens: 4000 },
        },
      },
      rateLimits: [],
    },
  }))

  const ui = await $.ui.mount({ plugin: 'usage-hud', surface: 'terminal', component: 'AbovePrompt', props: PROPS })
  expect(await ui.find({ key: 'cache' })).toBeUndefined()
  await ui.unmount()
})
