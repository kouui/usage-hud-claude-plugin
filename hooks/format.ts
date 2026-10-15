// Pure helpers: no engine access, so they are unit-tested directly.

export const BAR_WIDTH = 10

/** `█` cells for the used part and `░` for the rest. */
export function bar(percent: number, width = BAR_WIDTH): string {
  const p = Math.max(0, Math.min(100, Number(percent) || 0))
  const n = Math.round((p / 100) * width)
  return '█'.repeat(n) + '░'.repeat(width - n)
}

/** Green below 70, yellow below 90, red from 90. */
export function levelColor(percent: number): string {
  if (percent >= 90) return 'red'
  if (percent >= 70) return 'yellow'
  return 'green'
}

/** `claude-sonnet-5-5` becomes `Sonnet 5.5`; an id it does not know is returned as given. */
export function modelLabel(id: string): string {
  const m = /(opus|sonnet|haiku|fable)-(\d+)(?:-(\d{1,2}))?/i.exec(id)
  if (!m) return id
  const name = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()
  const version = m[3] ? `${m[2]}.${m[3]}` : m[2]
  return /\[1m\]/i.test(id) ? `${name} ${version} (1M)` : `${name} ${version}`
}

/** Time left until an ISO timestamp: `4h 36m`, `1d 20h`, `12m`, `now`; empty when unknown. */
export function countdown(resetsAt: string | undefined, nowMs: number): string {
  if (!resetsAt) return ''
  const t = Date.parse(resetsAt)
  if (!Number.isFinite(t)) return ''
  const mins = Math.floor((t - nowMs) / 60_000)
  if (mins <= 0) return 'now'
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** Label for a rate-limit window kind. */
export function windowLabel(kind: string): string {
  if (kind === 'five_hour') return 'Usage'
  if (kind === 'seven_day') return 'Weekly'
  if (kind === 'spend_limit') return 'Spend'
  return kind
}

/** Last path segment, for Windows and POSIX paths alike. */
export function baseName(path: string): string {
  const parts = path.replace(/[\\/]+$/, '').split(/[\\/]/)
  return parts[parts.length - 1] || path
}
