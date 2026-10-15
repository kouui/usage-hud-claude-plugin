import type { Register } from 'claude-code'

import { bar, baseName, countdown, levelColor, modelLabel, windowLabel } from './format'

const REFRESH_MS = 60_000 // countdowns move without any event, so redraw once a minute
const GIT_TTL_MS = 15_000

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

    const text = (value: string, props: Record<string, unknown> = {}) => Text({ ...props, children: [value] })
    const sep = () => text('│', { dimColor: true })

    // Line 1: [model] │ directory  git:(branch)
    const head = [text(`[${modelLabel(model)}]`, { color: 'cyan' }), sep(), text(baseName(cwd), { color: 'yellow' })]
    if (git.branch) head.push(text(`git:(${git.branch})`, { dimColor: true }))

    // Line 2: Context, then each reported rate-limit window, then cost.
    const ctx = usage.context
    const meters = [] as unknown[]
    if (ctx.percent === undefined || ctx.tokens === undefined) {
      meters.push(text('Context  --', { dimColor: true }))
    } else {
      meters.push(
        text('Context', { dimColor: true }),
        text(bar(ctx.percent), { color: levelColor(ctx.percent) }),
        text(`${ctx.percent}%`, { color: levelColor(ctx.percent) }),
      )
    }
    for (const r of usage.rateLimits) {
      meters.push(sep())
      const left = countdown(r.resetsAt, now)
      meters.push(
        text(windowLabel(r.kind), { dimColor: true }),
        text(bar(r.percentUsed), { color: levelColor(r.percentUsed) }),
        text(`${r.percentUsed}%`, { color: levelColor(r.percentUsed) }),
      )
      if (left) meters.push(text(`(resets in ${left})`, { dimColor: true }))
    }
    if (usage.cost) {
      meters.push(sep(), text(`$${usage.cost.usd.toFixed(2)}`, { dimColor: true }))
    }

    const row = (children: unknown[]) => Box({ flexDirection: 'row', columnGap: 1, flexWrap: 'wrap', children })
    // marginTop keeps the band off the last line of the conversation above it.
    return Box({ flexDirection: 'column', marginTop: 1, children: [row(head), row(meters)] })
  })
}
