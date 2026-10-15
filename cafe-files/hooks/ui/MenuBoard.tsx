// カフェの黒板メニュー風ヘッダー。desktop/vscode は 1 枚の Svg、terminal は Box + Text。
import type { Ctx } from '../types'
import { frameAt } from './Barista'
import type { Pet } from './Barista'

export type MenuCounts = { image: number; audio: number; video: number; doc: number; other: number; dirs: number }
export type MenuBoardProps = {
  title: string
  subtitle: string
  counts: MenuCounts
  sprite: Pet | null
  /** desktop は CSS px（呼び出し側で換算して渡す） */
  width: number
}

export const MENU_MAX_W = 560
export const MENU_MIN_W = 300
export const MENU_H = 170
export const SVG_LIMIT = 131072

const CHALK = '#F4EFE6'
const YELLOW = '#F2C57C'
const PINK = '#F29E8E'
export const ZERO_OPACITY = '0.32'
const FONT = `'Hiragino Maru Gothic ProN', 'Klee', 'Yomogi', 'Hiragino Sans', cursive, sans-serif`

/** メニュー行（表示順）。 */
export function menuRows(c: MenuCounts): Array<{ icon: string; label: string; n: number }> {
  return [
    { icon: '☕', label: '画像', n: c.image },
    { icon: '🎵', label: '音声', n: c.audio },
    { icon: '🎬', label: '動画', n: c.video },
    { icon: '📄', label: '書類', n: c.doc },
    { icon: '🍪', label: 'その他', n: c.other },
    { icon: '📁', label: 'フォルダ', n: c.dirs },
  ]
}

/** XML 用エスケープ（& < > " '）。 */
export function xmlEscape(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** 先頭から n 文字（コードポイント単位）。超えたら …。 */
export function clip(s: string, n: number): string {
  const a = Array.from(s)
  return a.length > n ? a.slice(0, n - 1).join('') + '…' : s
}

/** 末尾 n 文字を残す（パス向け）。 */
function clipHead(s: string, n: number): string {
  const a = Array.from(s)
  return a.length > n ? '…' + a.slice(a.length - n + 1).join('') : s
}

/** 見た目の幅（全角=1, 半角=0.56）を em 単位で概算。 */
function emWidth(s: string): number {
  let w = 0
  for (const ch of Array.from(s)) w += (ch.codePointAt(0) ?? 0) > 0x2e80 ? 1 : 0.58
  return w
}

const fmt = (n: number) => (n > 999 ? '999+' : String(Math.max(0, Math.floor(n || 0))))
const r1 = (n: number) => Math.round(n * 10) / 10

/** sprite の idle（最大 6 フレーム）を SMIL で切り替える <svg> 断片。 */
function baristaFragment(pet: Pet, x: number, y: number, size: number): string {
  // ホストの SVG は画像モード（スクリプト・<use>・入れ子 svg を避ける）で描かれるので、
  // フレームごとの <image> をそのまま並べ、display を SMIL で切り替える
  const frames = pet.frames.idle.slice(0, 6)
  const durs = frames.map((_, i) => pet.durations.idle[i] ?? 160)
  const total = durs.reduce((s, d) => s + d, 0) || 1
  const sc = size / Math.max(pet.w, pet.h)
  const w = r1(pet.w * sc)
  const h = r1(pet.h * sc)
  const ix = r1(x + (size - pet.w * sc) / 2)
  const iy = r1(y + size - pet.h * sc)
  let t = 0
  const imgs = frames
    .map((b64, i) => {
      const a = t / total
      const b = (t + durs[i]) / total
      t += durs[i]
      const img = (extra: string, anim: string) =>
        `<image x="${ix}" y="${iy}" width="${w}" height="${h}" image-rendering="pixelated" href="data:image/png;base64,${b64}"${extra}>${anim}</image>`
      if (frames.length === 1) return img('', '')
      let values: string
      let keyTimes: string
      if (a === 0) {
        values = 'inline;none'
        keyTimes = `0;${b.toFixed(4)}`
      } else if (b >= 0.99995) {
        values = 'none;inline'
        keyTimes = `0;${a.toFixed(4)}`
      } else {
        values = 'none;inline;none'
        keyTimes = `0;${a.toFixed(4)};${b.toFixed(4)}`
      }
      return img(
        ` display="${a === 0 ? 'inline' : 'none'}"`,
        `<animate attributeName="display" calcMode="discrete" values="${values}" keyTimes="${keyTimes}" dur="${total}ms" repeatCount="indefinite"/>`,
      )
    })
    .join('')
  return (
    `<ellipse cx="${r1(x + size / 2)}" cy="${r1(y + size - 1)}" rx="${r1(size * 0.34)}" ry="3.5" fill="#000" opacity="0.28"/>` +
    imgs
  )
}

/** 黒板メニューの SVG 文字列（desktop/vscode 用）。 */
export function menuBoardSvg(p: MenuBoardProps): string {
  const W = Math.round(Math.max(MENU_MIN_W, Math.min(p.width || MENU_MAX_W, MENU_MAX_W)))
  const H = MENU_H
  const pet = p.sprite && p.sprite.frames?.idle?.length ? p.sprite : null
  const side = pet ? 112 : 0 // バリスタが立つスペース（黒板の右脇）
  const bw = W - side // 木枠を含む黒板の幅
  const F = 9 // 木枠の太さ
  const ix = F
  const iy = F
  const iw = bw - F * 2
  const ih = H - F * 2

  // 右側のメニュー列
  const rows = menuRows(p.counts)
  const menuW = Math.min(176, Math.round(iw * 0.4))
  const mx = ix + iw - menuW - 12
  const rowH = 20
  const rowTop = iy + 26

  // 左側（タイトル列）
  const lx = ix + 16
  const lw = mx - lx - 18
  const title = clip(p.title || '/', 18)
  const tSize = Math.max(12, Math.min(30, Math.floor(lw / Math.max(1, emWidth(title)))))
  const subMax = Math.max(8, Math.floor(lw / 7.6))
  const subtitle = clipHead(p.subtitle || '', subMax)
  const titleY = iy + ih / 2 + tSize * 0.32 + 2
  const titleW = Math.min(lw, emWidth(title) * tSize)
  const squeeze = emWidth(title) * tSize > lw ? ` textLength="${Math.floor(lw)}" lengthAdjust="spacingAndGlyphs"` : ''

  const s: string[] = []
  s.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${xmlEscape(FONT)}">`,
  )
  s.push(
    `<defs>` +
      `<linearGradient id="mbWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A5233"/><stop offset="0.45" stop-color="#5B3A22"/><stop offset="1" stop-color="#3F2715"/></linearGradient>` +
      `<linearGradient id="mbBoard" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2F3B33"/><stop offset="1" stop-color="#26302A"/></linearGradient>` +
      `<radialGradient id="mbNail" cx="0.35" cy="0.35" r="0.7"><stop offset="0" stop-color="#E8DCC8"/><stop offset="0.5" stop-color="#9C8C76"/><stop offset="1" stop-color="#4A3B2C"/></radialGradient>` +
      `<filter id="mbNoise" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0.96  0 0 0 0 0.94  0 0 0 0 0.9  0 0 0 0.09 -0.02"/></filter>` +
      `<filter id="mbChalk" x="-5%" y="-20%" width="110%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="3" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="1.3"/></filter>` +
      `<filter id="mbSmudge"><feGaussianBlur stdDeviation="6"/></filter>` +
      `</defs>`,
  )

  // 木枠
  s.push(`<rect x="0.5" y="0.5" width="${bw - 1}" height="${H - 1}" rx="7" fill="url(#mbWood)" stroke="#2E1C0F" stroke-width="1"/>`)
  for (let i = 0; i < 4; i++) {
    const yy = 2 + i * 2.1
    s.push(`<line x1="8" y1="${r1(yy)}" x2="${bw - 8}" y2="${r1(yy + 0.4)}" stroke="#2E1C0F" stroke-opacity="0.18" stroke-width="0.7"/>`)
    s.push(`<line x1="8" y1="${r1(H - yy)}" x2="${bw - 8}" y2="${r1(H - yy - 0.4)}" stroke="#2E1C0F" stroke-opacity="0.18" stroke-width="0.7"/>`)
  }
  // 黒板面
  s.push(`<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" rx="2" fill="url(#mbBoard)"/>`)
  s.push(`<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" filter="url(#mbNoise)" opacity="0.9"/>`)
  // 消し跡（半透明のにじみ）
  s.push(`<ellipse cx="${r1(ix + iw * 0.32)}" cy="${r1(iy + ih * 0.7)}" rx="${r1(iw * 0.2)}" ry="16" fill="${CHALK}" opacity="0.05" filter="url(#mbSmudge)"/>`)
  s.push(`<ellipse cx="${r1(ix + iw * 0.75)}" cy="${r1(iy + 18)}" rx="${r1(iw * 0.16)}" ry="10" fill="${CHALK}" opacity="0.045" filter="url(#mbSmudge)"/>`)
  // かすれ線
  const strokes = [
    [0.08, 0.2, 0.3, 0.17],
    [0.5, 0.86, 0.7, 0.9],
    [0.15, 0.92, 0.28, 0.88],
    [0.62, 0.12, 0.9, 0.1],
  ]
  for (const [a, b, c, d] of strokes)
    s.push(`<line x1="${r1(ix + iw * a)}" y1="${r1(iy + ih * b)}" x2="${r1(ix + iw * c)}" y2="${r1(iy + ih * d)}" stroke="${CHALK}" stroke-opacity="0.07" stroke-width="5" stroke-linecap="round"/>`)
  // 内側の影
  s.push(`<rect x="${ix + 0.5}" y="${iy + 0.5}" width="${iw - 1}" height="${ih - 1}" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="1"/>`)
  // 釘
  for (const [nx, ny] of [
    [4.5, 4.5],
    [bw - 4.5, 4.5],
    [4.5, H - 4.5],
    [bw - 4.5, H - 4.5],
  ])
    s.push(`<circle cx="${nx}" cy="${ny}" r="2.6" fill="url(#mbNail)" stroke="#2E1C0F" stroke-width="0.5"/>`)

  // 文字（チョーク）
  s.push(`<g filter="url(#mbChalk)">`)
  s.push(`<text x="${lx}" y="${iy + 22}" font-size="13" fill="${CHALK}" fill-opacity="0.92" letter-spacing="1">${xmlEscape('本日のメニュー')}</text>`)
  s.push(`<path d="M${lx} ${iy + 27} q 23 3 46 0 t 46 0" fill="none" stroke="${YELLOW}" stroke-opacity="0.75" stroke-width="1.4" stroke-linecap="round"/>`)
  s.push(`<text x="${lx + 108}" y="${iy + 21}" font-size="11" fill="${PINK}" fill-opacity="0.85">✿</text>`)
  s.push(`<text x="${r1(lx + lw / 2)}" y="${r1(titleY)}" text-anchor="middle" font-size="${tSize}" font-weight="bold" fill="${CHALK}"${squeeze}>${xmlEscape(title)}</text>`)
  s.push(
    `<path d="M${r1(lx + lw / 2 - titleW / 2)} ${r1(titleY + 7)} q ${r1(titleW / 4)} 4 ${r1(titleW / 2)} 0 t ${r1(titleW / 2)} 0" fill="none" stroke="${PINK}" stroke-opacity="0.7" stroke-width="1.6" stroke-linecap="round"/>`,
  )
  s.push(`<text x="${r1(lx + lw / 2)}" y="${r1(titleY + 26)}" text-anchor="middle" font-size="12" fill="${CHALK}" fill-opacity="0.55">${xmlEscape(subtitle)}</text>`)

  // 区切り（縦のチョーク線）
  s.push(`<line x1="${mx - 10}" y1="${iy + 16}" x2="${mx - 11}" y2="${iy + ih - 16}" stroke="${CHALK}" stroke-opacity="0.18" stroke-width="1.2" stroke-dasharray="6 3"/>`)

  // メニュー行
  rows.forEach((row, i) => {
    const y = rowTop + i * rowH + 12
    const zero = !(row.n > 0)
    const label = `${row.icon} ${row.label}`
    const labelEnd = mx + emWidth(row.label) * 13 + 22
    const numStart = mx + menuW - fmt(row.n).length * 8 - 6
    s.push(`<g class="row${zero ? ' zero' : ''}" data-kind="${row.label}"${zero ? ` opacity="${ZERO_OPACITY}"` : ''}>`)
    s.push(`<text x="${mx}" y="${y}" font-size="13" fill="${CHALK}">${xmlEscape(label)}</text>`)
    if (numStart - labelEnd > 6)
      s.push(`<line x1="${r1(labelEnd)}" y1="${y - 3}" x2="${r1(numStart)}" y2="${y - 3}" stroke="${CHALK}" stroke-opacity="0.6" stroke-width="1.4" stroke-dasharray="0.1 4.5" stroke-linecap="round"/>`)
    s.push(`<text x="${mx + menuW}" y="${y}" text-anchor="end" font-size="14" font-weight="bold" fill="${zero ? CHALK : YELLOW}">${fmt(row.n)}</text>`)
    s.push(`</g>`)
  })
  s.push(`</g>`)

  // sprite が無いときの小さなカップの落書き
  if (!pet) {
    const cx = lx + 2
    const cy = iy + ih - 22
    s.push(
      `<g fill="none" stroke="${CHALK}" stroke-opacity="0.5" stroke-width="1.3" stroke-linecap="round" filter="url(#mbChalk)">` +
        `<path d="M${cx} ${cy} h16 v7 q0 7 -8 7 q-8 0 -8 -7 z"/><path d="M${cx + 16} ${cy + 2} q6 0 5 4 q-1 3 -5 3"/>` +
        `<path d="M${cx + 5} ${cy - 3} q-2 -3 0 -6 M${cx + 10} ${cy - 3} q-2 -3 0 -6"/></g>`,
    )
  }

  if (pet) s.push(baristaFragment(pet, bw + 4, H - 110, 106))

  s.push(`</svg>`)
  return s.join('')
}

/** 黒板メニュー風ヘッダー。 */
export function MenuBoard(ctx: Ctx, p: MenuBoardProps): any {
  const { els } = ctx
  const { Box, Text } = els
  if (ctx.surface !== 'terminal' && els.Svg) {
    const svg = menuBoardSvg(p)
    const W = Math.round(Math.max(MENU_MIN_W, Math.min(p.width || MENU_MAX_W, MENU_MAX_W)))
    const alt = `本日のメニュー: ${p.title} — ` + menuRows(p.counts).map((r) => `${r.label} ${r.n}`).join('、')
    return (
      <Box flexDirection="row">
        <els.Svg source={svg} alt={alt} width={W} height={MENU_H} />
      </Box>
    )
  }
  // terminal: 枠付きの Box にチョーク風テキスト
  const rows = menuRows(p.counts)
  const cols = Math.max(20, ctx.width || 40)
  const showPet = !!(p.sprite && els.Image && cols >= 44)
  const titleMax = Math.max(6, Math.min(18, cols - (showPet ? 16 : 6)))
  const lines = rows.map((r) => {
    const left = `${r.icon} ${r.label} `
    const num = ` ${fmt(r.n)}`
    return { text: left + '‥'.repeat(Math.max(2, 14 - r.label.length * 2)) + num, zero: !(r.n > 0) }
  })
  return (
    <Box borderStyle="round" borderColor="text" paddingX={1} flexDirection="row">
      <Box flexDirection="column" flexGrow={1}>
        <Text dimColor>本日のメニュー</Text>
        <Text bold color="text">
          {clip(p.title || '/', titleMax)}
        </Text>
        <Text dimColor>{clipHead(p.subtitle || '', Math.max(8, cols - (showPet ? 16 : 6)))}</Text>
        <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
          {lines.map((l) =>
            l.zero ? (
              <Text key={l.text} dimColor>
                {l.text}
              </Text>
            ) : (
              <Text key={l.text} color="text">
                {l.text}
              </Text>
            ),
          )}
        </Box>
      </Box>
      {showPet ? (
        <Box flexDirection="column" justifyContent="flex-end">
          <els.Image key="menuboard-barista" source={{ png: frameAt(p.sprite as Pet, 'idle', 0) }} columns={10} rows={5} alt="(｡•ᴗ•｡)☕" />
        </Box>
      ) : null}
    </Box>
  )
}
