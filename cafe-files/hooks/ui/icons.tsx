import type { Kind } from '../types'
import type { Ctx } from '../types'
import { T } from '../theme'

export type IconName =
  | Kind
  | 'folder'
  | 'home'
  | 'up'
  | 'prev'
  | 'next'
  | 'close'
  | 'gear'
  | 'copy'
  | 'insert'
  | 'coffee'

/** terminal / ボタン内で使う文字アイコン */
export const GLYPH: Record<IconName, string> = {
  image: '🖼',
  audio: '♪',
  video: '🎬',
  doc: '📄',
  other: '📦',
  folder: '📁',
  home: '⌂',
  up: '↑',
  prev: '◀',
  next: '▶',
  close: '✕',
  gear: '⚙',
  copy: '⧉',
  insert: '↵',
  coffee: '☕',
}

export const KIND_LABEL: Record<Kind, string> = {
  image: '画像',
  audio: '音声',
  video: '動画',
  doc: '書類',
  other: 'その他',
}

export function glyph(name: IconName): string {
  return GLYPH[name]
}

/** 種別 → 文字アイコン（フォルダは 'folder' を渡す） */
export function kindGlyph(kind: Kind, isDir = false): string {
  return isDir ? GLYPH.folder : GLYPH[kind]
}

/** 拡張子バッジ用（大文字、先頭の . なし、最大5文字） */
export function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  if (i <= 0 || i === name.length - 1) return ''
  return name.slice(i + 1).toUpperCase().slice(0, 5)
}

function colors() {
  const c: any = (T as any)?.colors ?? {}
  return {
    cream: c.cream ?? '#F5ECDD',
    milk: c.milk ?? '#FBF6EC',
    espresso: c.espresso ?? '#3B2A20',
    caramel: c.caramel ?? '#C08A4F',
    line: c.line ?? '#D8C7AE',
    muted: c.muted ?? '#8A7968',
    accent: c.accent ?? '#B5543A',
  }
}

function symbol(name: IconName, ink: string): string {
  switch (name) {
    case 'image':
      return `<circle cx="26" cy="31" r="4" fill="${ink}"/><path d="M16 50l10-12 7 8 6-6 9 10z" fill="${ink}"/>`
    case 'audio':
      return `<path d="M27 52V30l14-4v20" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/><circle cx="23" cy="52" r="4" fill="${ink}"/><circle cx="37" cy="46" r="4" fill="${ink}"/>`
    case 'video':
      return `<rect x="16" y="32" width="22" height="18" rx="3" fill="${ink}"/><path d="M40 38l8-5v14l-8-5z" fill="${ink}"/>`
    case 'doc':
      return `<path d="M18 34h28M18 41h28M18 48h18" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`
    default:
      return `<circle cx="24" cy="42" r="3" fill="${ink}"/><circle cx="32" cy="42" r="3" fill="${ink}"/><circle cx="40" cy="42" r="3" fill="${ink}"/>`
  }
}

/** 64x64 の喫茶風アイコン SVG 文字列 */
export function iconSvg(name: IconName): string {
  const k = colors()
  if (name === 'folder') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M6 16a4 4 0 0 1 4-4h14l6 7h24a4 4 0 0 1 4 4v29a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" fill="${k.caramel}"/><path d="M6 27h52v22a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" fill="${k.cream}" stroke="${k.espresso}" stroke-width="2"/><circle cx="32" cy="40" r="5" fill="${k.espresso}"/><path d="M37 38q5 0 5 3t-5 3" fill="none" stroke="${k.espresso}" stroke-width="2"/></svg>`
  }
  if (name === 'coffee') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M12 24h34v14a12 12 0 0 1-12 12H24a12 12 0 0 1-12-12z" fill="${k.cream}" stroke="${k.espresso}" stroke-width="3"/><path d="M46 28h4a6 6 0 0 1 0 12h-4" fill="none" stroke="${k.espresso}" stroke-width="3"/></svg>`
  }
  const kind: Kind = (['image', 'audio', 'video', 'doc', 'other'] as const).includes(name as Kind) ? (name as Kind) : 'other'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M14 6h26l12 12v38a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" fill="${k.milk}" stroke="${k.espresso}" stroke-width="2"/><path d="M40 6v12h12" fill="${k.cream}" stroke="${k.espresso}" stroke-width="2"/>${symbol(kind, k.caramel)}</svg>`
}

/** 大きめの種別/フォルダアイコン。terminal は文字、他は Svg */
export function Icon(
  ctx: Ctx,
  name: IconName,
  o: { size?: number; color?: string } = {},
): any {
  const { Text, Svg } = ctx.els
  if (ctx.surface === 'terminal' || !Svg) {
    return <Text color={o.color}>{GLYPH[name]}</Text>
  }
  const size = o.size ?? 64
  return <Svg source={iconSvg(name)} alt={name} width={size} height={size} />
}
