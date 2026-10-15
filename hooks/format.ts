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

/**
 * A bar with its label written inside: ` Context 31%` padded to `width` cells and cut at the
 * filled part, so the first piece is drawn on the "used" color and the second on the "free" one.
 */
export function labelBar(label: string, percent: number, width: number): { filled: string; empty: string; text: string } {
  const p = Math.max(0, Math.min(100, Number(percent) || 0))
  const body = ` ${label} ${p}%`
  const text = body.length >= width ? body : body.padEnd(width, ' ')
  const n = Math.round((p / 100) * text.length)
  return { filled: text.slice(0, n), empty: text.slice(n), text }
}

/** Terminal cells a string takes: East Asian wide characters count as two. */
export function displayWidth(s: string): number {
  let w = 0
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0
    const isWide =
      (c >= 0x1100 && c <= 0x115f) ||
      (c >= 0x2e80 && c <= 0xa4cf) ||
      (c >= 0xac00 && c <= 0xd7a3) ||
      (c >= 0xf900 && c <= 0xfaff) ||
      (c >= 0xfe30 && c <= 0xfe6f) ||
      (c >= 0xff00 && c <= 0xff60) ||
      (c >= 0xffe0 && c <= 0xffe6) ||
      (c >= 0x20000 && c <= 0x3fffd)
    w += isWide ? 2 : 1
  }
  return w
}

/** Cells a row of pieces takes when drawn with `gap` cells between them. */
export function rowWidth(texts: readonly string[], gap = 1): number {
  if (texts.length === 0) return 0
  return texts.reduce((sum, t) => sum + displayWidth(t), 0) + gap * (texts.length - 1)
}

/** Last path segment, for Windows and POSIX paths alike. */
export function baseName(path: string): string {
  const parts = path.replace(/[\\/]+$/, '').split(/[\\/]/)
  return parts[parts.length - 1] || path
}
