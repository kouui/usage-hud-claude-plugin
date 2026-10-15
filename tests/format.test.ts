import { test, expect } from 'claude-code/testing'

import { bar, baseName, countdown, displayWidth, levelColor, modelLabel, rowWidth, windowLabel } from '../hooks/format'

test('bar fills in proportion and clamps', async () => {
  expect(bar(0)).toBe('░░░░░░░░░░')
  expect(bar(31)).toBe('███░░░░░░░')
  expect(bar(100)).toBe('██████████')
  expect(bar(250)).toBe('██████████')
  expect(bar(-5)).toBe('░░░░░░░░░░')
})

test('levelColor changes at 70 and 90', async () => {
  expect(levelColor(69)).toBe('green')
  expect(levelColor(70)).toBe('yellow')
  expect(levelColor(89)).toBe('yellow')
  expect(levelColor(90)).toBe('red')
})

test('modelLabel reads a model id', async () => {
  expect(modelLabel('claude-sonnet-5-5')).toBe('Sonnet 5.5')
  expect(modelLabel('claude-opus-5-5')).toBe('Opus 5.5')
  expect(modelLabel('claude-fable-5-1')).toBe('Fable 5.1')
  expect(modelLabel('claude-haiku-5')).toBe('Haiku 5')
  expect(modelLabel('claude-sonnet-5-5[1m]')).toBe('Sonnet 5.5 (1M)')
  expect(modelLabel('some-other-model')).toBe('some-other-model')
})

test('countdown spells days, hours and minutes', async () => {
  const now = Date.parse('2026-10-15T00:00:00Z')
  expect(countdown('2026-10-15T04:36:30Z', now)).toBe('4h 36m')
  expect(countdown('2026-10-16T20:00:00Z', now)).toBe('1d 20h')
  expect(countdown('2026-10-15T00:12:00Z', now)).toBe('12m')
  expect(countdown('2026-10-14T23:00:00Z', now)).toBe('now')
  expect(countdown(undefined, now)).toBe('')
  expect(countdown('not a date', now)).toBe('')
})

test('windowLabel names the plan windows', async () => {
  expect(windowLabel('five_hour')).toBe('Usage')
  expect(windowLabel('seven_day')).toBe('Weekly')
  expect(windowLabel('spend_limit')).toBe('Spend')
  expect(windowLabel('other')).toBe('other')
})

test('baseName takes the last segment of a Windows or POSIX path', async () => {
  expect(baseName('D:\\share\\src\\game-dev-skills')).toBe('game-dev-skills')
  expect(baseName('D:\\share\\src\\game-dev-skills\\')).toBe('game-dev-skills')
  expect(baseName('/home/u/proj/')).toBe('proj')
  expect(baseName('/home/u/proj')).toBe('proj')
})

test('displayWidth counts wide characters as two cells', async () => {
  expect(displayWidth('abc')).toBe(3)
  expect(displayWidth('整理skill')).toBe(9)
  expect(displayWidth('│')).toBe(1)
  expect(displayWidth('')).toBe(0)
})

test('rowWidth adds the gaps between pieces', async () => {
  expect(rowWidth([])).toBe(0)
  expect(rowWidth(['ab'])).toBe(2)
  expect(rowWidth(['ab', 'cde', '整'], 1)).toBe(2 + 3 + 2 + 2)
  expect(rowWidth(['ab', 'cd'], 3)).toBe(2 + 2 + 3)
})
