export function todayDate(): string {
  return formatDate(new Date())
}

export function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatLongDate(d: Date = new Date()): string {
  const cap = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1)
  const weekday = cap(d.toLocaleDateString('it-IT', { weekday: 'long' }))
  const month = cap(d.toLocaleDateString('it-IT', { month: 'long' }))
  return `${weekday} ${d.getDate()} ${month} ${d.getFullYear()}`
}

export function dayBounds(date: string): { start: number; end: number } {
  const start = new Date(`${date}T00:00:00`).getTime()
  const end = new Date(`${date}T23:59:59.999`).getTime()
  return { start, end }
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

export function formatClock(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h <= 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function datetimeLocalValue(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
