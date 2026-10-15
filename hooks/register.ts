import type { Register } from 'claude-code'

import { baseName, cacheStats, countdown, labelBar, levelColor, modelLabel, rowWidth, tokenLabel, windowLabel } from './format'

const REFRESH_MS = 60_000 // countdowns move without any event, so redraw once a minute
const GIT_TTL_MS = 15_000
const BAR_WIDTH = 20 // cells of a bar, label included
const COMPACT_BAR = 15 // cells of a bar when everything has to fit on one row
const GAP = 1 // cells between pieces in a row
const SPARE = 2 // cells left free at the right end so a row never wraps by one

// A piece is one run of text, or a bar: several runs drawn side by side with no gap.
type Run = { text: string; props: Record<string, unknown> }
type Piece = { text: string; props: Record<string, unknown>; runs?: Run[]; key?: string }

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
    // `breakdown: 'summary'` is a local estimate (no request) and carries the compaction window.
    // Without a bound session it can fail; then the plain figures are used.
    const readUsage = async () => {
      try {
        return await $.session.usage({ breakdown: 'summary' })
      } catch {
        return await $.session.usage()
      }
    }
    const [usage, model, cwd, now] = await Promise.all([readUsage(), $.session.model(), $.session.cwd(), $.clock.now()])
    if (cwd !== git.cwd || now - git.at > GIT_TTL_MS) void refreshBranch($, cwd)

    const piece = (text: string, props: Record<string, unknown> = {}): Piece => ({ text, props })
    const sep = () => piece('│', { dimColor: true })

    // A bar with its label inside: the used part on the level color, the rest on a dim one.
    // No figure yet (undefined) draws the whole bar dim with `--` in place of the percent.
    const meter = (key: string, label: string, percent: number | undefined, width: number, suffix = ''): Piece => {
      const dim = { color: 'white', backgroundColor: 'blackBright' }
      if (percent === undefined) {
        const t = ` ${label} -- `.padEnd(width, ' ')
        return { text: t, props: {}, key, runs: [{ text: t, props: dim }] }
      }
      const t = labelBar(label, percent, width, suffix)
      const runs: Run[] = []
      if (t.filled) runs.push({ text: t.filled, props: { color: 'black', backgroundColor: levelColor(percent) } })
      if (t.empty) runs.push({ text: t.empty, props: dim })
      return { text: t.text, props: {}, key, runs }
    }

    // The pieces in two groups. `isCompact` shortens the bars so one row can fit.
    const build = (isCompact: boolean) => {
      const width = isCompact ? COMPACT_BAR : BAR_WIDTH

      // Group 1: [model] │ directory  git:(branch)
      const head: Piece[] = [piece(`[${modelLabel(model)}]`, { color: 'cyan' }), sep(), piece(baseName(cwd), { color: 'yellow' })]
      if (git.branch) head.push(piece(`git:(${git.branch})`, { dimColor: true }))

      // Group 2: Context, then each reported rate-limit window.
      // The percent is measured against the compaction window (autoCompactWindow), not the model's
      // longest context; the breakdown holds that window. Without it the engine's own percent is used.
      const ctx = usage.context
      const windowTokens = ctx.breakdown?.rawMaxTokens ?? ctx.window
      const hasContext = ctx.tokens !== undefined && (windowTokens > 0 || ctx.percent !== undefined)
      const ctxPercent = hasContext ? (windowTokens > 0 ? Math.round(((ctx.tokens as number) / windowTokens) * 100) : ctx.percent) : undefined
      // Tokens of the messages alone, out of the window: ` Context 31% (msg 48k/400k) `.
      const msgTokens = ctx.breakdown?.categories.find((c) => c.name === 'Messages')?.tokens
      const ctxSuffix = hasContext && msgTokens !== undefined && windowTokens > 0 ? `(msg ${tokenLabel(msgTokens)}/${tokenLabel(windowTokens)})` : ''
      const meters: Piece[] = [meter('context', 'Context', ctxPercent, width, ctxSuffix)]
      for (const r of usage.rateLimits) {
        // The time to reset sits inside the bar, after the percent: ` Usage 1% (3h 26m) `.
        const left = countdown(r.resetsAt, now)
        meters.push(sep(), meter(`window-${r.kind}`, windowLabel(r.kind), r.percentUsed, width, left ? `(${left})` : ''))
      }
      // Cost is not shown. To bring it back: if (usage.cost) meters.push(sep(), piece(`$${usage.cost.usd.toFixed(2)}`, { dimColor: true }))

      // Group 3: the prompt cache of the last response: uncached input, read, written, hit rate, output.
      const cache: Piece[] = []
      if (ctx.breakdown?.apiUsage) {
        const c = cacheStats(ctx.breakdown.apiUsage)
        const hit = c.hit === undefined ? '--' : `${c.hit}%`
        const lead = `in ${tokenLabel(c.input)}  cr ${tokenLabel(c.read)}  cw ${tokenLabel(c.write)}  `
        const tail = `  out ${tokenLabel(c.output)}`
        const hitColor = c.hit === undefined ? undefined : c.hit >= 80 ? 'green' : c.hit >= 50 ? 'yellow' : 'red'
        const hitText = `hit ${hit}`
        cache.push({
          text: lead + hitText + tail,
          props: {},
          key: 'cache',
          runs: [
            { text: lead, props: { dimColor: true } },
            { text: hitText, props: hitColor ? { color: hitColor } : { dimColor: true } },
            { text: tail, props: { dimColor: true } },
          ],
        })
      }
      return { head, meters, cache }
    }

    // Full on one row if it fits, else compact on one row, else full on two rows.
    const columns = typeof e.props.bodyColumns === 'number' ? e.props.bodyColumns : 80
    const fits = (pieces: Piece[]) => rowWidth(pieces.map((p) => p.text), GAP) <= columns - SPARE
    const full = build(false)
    const compact = build(true)
    // The cache group goes on the right: at the end of the row, or at the end of the meters row.
    const withCache = (b: ReturnType<typeof build>, pieces: Piece[]) => (b.cache.length ? [...pieces, sep(), ...b.cache] : pieces)
    const fullRow = withCache(full, [...full.head, sep(), ...full.meters])
    const compactRow = withCache(compact, [...compact.head, sep(), ...compact.meters])
    const twoRow = [full.head, withCache(full, full.meters)]
    const rows: Piece[][] = fits(fullRow)
      ? [fullRow]
      : fits(compactRow)
        ? [compactRow]
        : fits(twoRow[1])
          ? twoRow
          : [full.head, full.meters, full.cache].filter((r) => r.length > 0)

    const drawPiece = (p: Piece) =>
      p.runs
        ? Box({ key: p.key, flexDirection: 'row', children: p.runs.map((r) => Text({ ...r.props, children: [r.text] })) })
        : Text({ ...p.props, children: [p.text] })

    const draw = (pieces: Piece[]) => Box({ flexDirection: 'row', columnGap: GAP, flexWrap: 'wrap', children: pieces.map(drawPiece) })

    // marginTop keeps the band off the last line of the conversation above it.
    return Box({ flexDirection: 'column', marginTop: 1, children: rows.map(draw) })
  })
}
