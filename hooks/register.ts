import type { Register } from 'claude-code'

import { bar, baseName, countdown, levelColor, modelLabel, rowWidth, windowLabel } from './format'

const REFRESH_MS = 60_000 // countdowns move without any event, so redraw once a minute
const GIT_TTL_MS = 15_000
const BAR_WIDTH = 10
const COMPACT_BAR = 6 // bar cells when everything has to fit on one row
const GAP = 1 // cells between pieces in a row
const SPARE = 2 // cells left free at the right end so a row never wraps by one

type Piece = { text: string; props: Record<string, unknown> }

// Module variables reset on a hot reload; they only hold what is cheap to read again.
const git = { branch: '', cwd: '', at: 0, isTicking: false }

// The branch is read outside the draw: a render hook answers from what is already known.
async function refreshBranch($: any, cwd: string): Promise<void> {
  git.at = await $.clock.now()
  git.cwd = cwd
  let next = ''
  try {
    const ran = await $.process.run(['git', '-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'], { timeoutMs: 2000 })
    if (ran.exitCode === 0) next = String(ran.stdout).trim()
  } catch {
    next = ''
  }
  if (next !== git.branch) {
    git.branch = next
    $.ui.invalidate('ui.render')
  }
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    if (!git.isTicking) {
      git.isTicking = true
      $.clock.every(REFRESH_MS, () => $.ui.invalidate('ui.render'))
    }
    return next(e)
  })

  // The figures moved (context fill, a rate-limit window, cost): draw again.
  on('session.measure', async ($, e, next) => {
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    void refreshBranch($, await $.session.cwd())
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const [usage, model, cwd, now] = await Promise.all([$.session.usage(), $.session.model(), $.session.cwd(), $.clock.now()])
    if (cwd !== git.cwd || now - git.at > GIT_TTL_MS) void refreshBranch($, cwd)

    const piece = (text: string, props: Record<string, unknown> = {}): Piece => ({ text, props })
    const sep = () => piece('│', { dimColor: true })

    // The pieces in two groups. `isCompact` shortens the bars and the reset text so one row can fit.
    const build = (isCompact: boolean) => {
      const barWidth = isCompact ? COMPACT_BAR : BAR_WIDTH
      const meterBar = (percent: number) => piece(bar(percent, barWidth), { color: levelColor(percent) })

      // Group 1: [model] │ directory  git:(branch)
      const head: Piece[] = [piece(`[${modelLabel(model)}]`, { color: 'cyan' }), sep(), piece(baseName(cwd), { color: 'yellow' })]
      if (git.branch) head.push(piece(`git:(${git.branch})`, { dimColor: true }))

      // Group 2: Context, then each reported rate-limit window, then cost.
      const ctx = usage.context
      const meters: Piece[] = []
      if (ctx.percent === undefined || ctx.tokens === undefined) {
        meters.push(piece('Context  --', { dimColor: true }))
      } else {
        meters.push(piece('Context', { dimColor: true }), meterBar(ctx.percent), piece(`${ctx.percent}%`, { color: levelColor(ctx.percent) }))
      }
      for (const r of usage.rateLimits) {
        meters.push(sep(), piece(windowLabel(r.kind), { dimColor: true }), meterBar(r.percentUsed))
        meters.push(piece(`${r.percentUsed}%`, { color: levelColor(r.percentUsed) }))
        const left = countdown(r.resetsAt, now)
        if (left) meters.push(piece(isCompact ? `(${left})` : `(resets in ${left})`, { dimColor: true }))
      }
      // Cost is not shown. To bring it back: if (usage.cost) meters.push(sep(), piece(`$${usage.cost.usd.toFixed(2)}`, { dimColor: true }))
      return { head, meters }
    }

    // Full on one row if it fits, else compact on one row, else full on two rows.
    const columns = typeof e.props.bodyColumns === 'number' ? e.props.bodyColumns : 80
    const fits = (pieces: Piece[]) => rowWidth(pieces.map((p) => p.text), GAP) <= columns - SPARE
    const full = build(false)
    const compact = build(true)
    const fullRow = [...full.head, sep(), ...full.meters]
    const compactRow = [...compact.head, sep(), ...compact.meters]
    const rows: Piece[][] = fits(fullRow) ? [fullRow] : fits(compactRow) ? [compactRow] : [full.head, full.meters]

    const draw = (pieces: Piece[]) =>
      Box({
        flexDirection: 'row',
        columnGap: GAP,
        flexWrap: 'wrap',
        children: pieces.map((p) => Text({ ...p.props, children: [p.text] })),
      })

    // marginTop keeps the band off the last line of the conversation above it.
    return Box({
      flexDirection: 'column',
      marginTop: 1,
      children: rows.map(draw),
    })
  })
}
