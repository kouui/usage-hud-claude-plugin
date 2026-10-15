import { test, expect } from 'claude-code/testing'

import { bar, baseName, countdown, displayWidth, labelBar, levelColor, modelLabel, rowWidth, tokenLabel, windowLabel } from '../hooks/format'

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

test('labelBar writes the label and percent inside the bar and cuts at the used part', async () => {
  const b = labelBar('Context', 50, 20)
  expect(b.text).toBe(' Context 50%        ')
  expect(b.text.length).toBe(20)
  expect(b.filled).toBe(' Context 5')
  expect(b.filled + b.empty).toBe(b.text)

  expect(labelBar('Usage', 0, 16).filled).toBe('')
  expect(labelBar('Usage', 100, 16).empty).toBe('')
  expect(labelBar('Weekly', 91, 15).text).toBe(' Weekly 91%    ')
  // a label longer than the width is kept whole
  expect(labelBar('A very long label', 10, 8).text).toBe(' A very long label 10% ')
})

test('labelBar puts the reset time inside the bar after the percent', async () => {
  const b = labelBar('Usage', 1, 18, '(3h 26m)')
  expect(b.text).toBe(' Usage 1% (3h 26m) ')
  expect(b.filled + b.empty).toBe(b.text)
  // the suffix widens the bar past `width` rather than being cut
  expect(labelBar('Weekly', 91, 15, '(1d 20h)').text).toBe(' Weekly 91% (1d 20h) ')
  expect(labelBar('Weekly', 91, 30, '(1d 20h)').text.length).toBe(30)
})

test('tokenLabel shortens counts', async () => {
  expect(tokenLabel(950)).toBe('950')
  expect(tokenLabel(1200)).toBe('1.2k')
  expect(tokenLabel(48_300)).toBe('48k')
  expect(tokenLabel(400_000)).toBe('400k')
  expect(tokenLabel(1_000_000)).toBe('1M')
})
