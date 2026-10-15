import type { Actions, Ctx, Entry } from '../types'
import { mkButton, BG, PANEL, PANEL2, INK, SUB, ACC, RULE, RULE_HI } from './Btn'
import { extOf } from './icons'
import { Thumb } from './Thumb'

const TARGET = { s: 14, m: 20, l: 30 } as const
const GAP = 1

/** ペイン幅（セル）とサイズから 1 行の列数とカード幅を決める（レスポンシブ） */
export function layoutFor(width: number, size: 's' | 'm' | 'l' = 'm'): { cols: number; cardW: number } {
  const w = Math.max(12, (width || 40) - 2)
  const t = TARGET[size]
  const cols = Math.max(1, Math.floor((w + GAP) / (t + GAP)))
  const cardW = Math.max(12, Math.floor((w - GAP * (cols - 1)) / cols))
  return { cols, cardW }
}

export function columnsFor(width: number, size: 's' | 'm' | 'l' = 'm'): number {
  return layoutFor(width, size).cols
}

export const MAX_FILES = 120

/** 1 文字の表示セル幅（全角・絵文字=2、結合/ZWJ/異体字セレクタ=0） */
function cw(cp: number): number {
  if (cp === 0x200d || (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0x0300 && cp <= 0x036f)) return 0
  if (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1faff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  )
    return 2
  return 1
}

export function textWidth(s: string): number {
  let w = 0
  for (const ch of s) w += cw(ch.codePointAt(0)!)
  return w
}

/** 表示幅 max セル以内に収める。拡張子を残して真ん中を省略。 */
export function shorten(name: string, max: number): string {
  if (textWidth(name) <= max) return name
  const dot = name.lastIndexOf('.')
  let ext = dot > 0 && name.length - dot <= 6 ? name.slice(dot) : ''
  if (textWidth(ext) + 2 > max) ext = ''
  const budget = Math.max(1, max - textWidth(ext) - 1)
  let out = ''
  let w = 0
  for (const ch of ext ? name.slice(0, dot) : name) {
    const c = cw(ch.codePointAt(0)!)
    if (w + c > budget) break
    out += ch
    w += c
  }
  return out + '…' + ext
}

function esc(t: string): string {
  return t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function sizeOf(n: number): string {
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`
  return `${(n / 1024 / 1024).toFixed(1)}MB`
}

/** メニューの見出し（クラフト紙のタグ＋点線）。desktop は Svg、terminal は Text */
export function sectionSvg(label: string, count: number, width: number): string {
  const w = Math.max(200, Math.min(width, 560))
  const text = `${esc(label)}  ·  ${count}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="34" viewBox="0 0 ${w} 34">
<defs><linearGradient id="k" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#C99A62"/><stop offset="1" stop-color="#A97A45"/></linearGradient></defs>
<path d="M2 6 h170 l12 11 l-12 11 h-170 z" fill="url(#k)"/>
<circle cx="12" cy="17" r="3" fill="#F6EEDF" opacity="0.9"/>
<text x="24" y="22" font-family="'Hiragino Maru Gothic ProN','Hiragino Sans',sans-serif" font-size="14" font-weight="700" fill="#3B2A20">${text}</text>
<line x1="192" y1="17" x2="${w - 8}" y2="17" stroke="#A97A45" stroke-width="1.5" stroke-dasharray="2 5" stroke-linecap="round"/>
</svg>`
}

function Section(ctx: Ctx, key: string, label: string, count: number): any {
  const { Box, Text, Svg } = ctx.els
  if (ctx.surface === 'terminal' || !Svg) {
    return (
      <Text key={key} color={ACC} bold>
        ── {label} ({count}) ──
      </Text>
    )
  }
  const px = Math.max(220, (ctx.width || 40) * 8)
  return (
    <Box key={key}>
      <Svg source={sectionSvg(label, count, px)} alt={`${label} ${count}`} height={34} />
    </Box>
  )
}

/** 棚のフォルダ（クラフト封筒） */
const FOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="28" viewBox="0 0 36 28"><path d="M2 5 q0-3 3-3 h9 l3 3 h14 q3 0 3 3 v16 q0 3-3 3 h-26 q-3 0-3-3z" fill="#B9793C"/><path d="M2 10 h32 v14 q0 3-3 3 h-26 q-3 0-3-3z" fill="#D9A366"/><ellipse cx="18" cy="18" rx="4" ry="2.6" fill="#5B3A22" transform="rotate(-25 18 18)"/><path d="M15.5 19.5 q2.5-1.5 5-3" stroke="#D9A366" stroke-width="0.9" fill="none"/></svg>`

function FolderTile(ctx: Ctx, e: Entry, i: number, actions: Actions): any {
  const { Box, Svg } = ctx.els
  const Button: any = mkButton(ctx)
  const isTerm = ctx.surface === 'terminal' || !Svg
  return (
    <Box
      key={`dir-${i}`}
      flexDirection="row"
      alignItems="center"
      columnGap={1}
      borderStyle="round"
      borderColor={RULE}
      backgroundColor={PANEL}
      paddingX={1}
      hover={{ borderColor: RULE_HI, backgroundColor: PANEL2 }}
    >
      {!isTerm && <Svg source={FOLDER_SVG} alt="フォルダ" width={30} height={24} />}
      <Button
        key={`open-${i}`}
        label={isTerm ? `📁 ${shorten(e.name, 22)}` : shorten(e.name, 22)}
        onPress={() => actions.openDir(e.path)}
      />
    </Box>
  )
}

/**
 * サムネ全体を押せるようにする: 何も描かない透明な Client（./Hit）をサムネの上に重ねる。
 * 押すと { open: path } が ui.message に届き、詳細を開く。
 */
function ThumbHit(ctx: Ctx, i: number, path: string): any {
  const { Box, Client } = ctx.els
  if (!Client || ctx.surface === 'terminal') return null
  return (
    <Box position="absolute" top={0} left={0} right={0} bottom={0}>
      <Client key={`thumb-hit-${i}`} module="./Hit.tsx" props={{ msg: { open: path } }} width="100%" height="100%" />
    </Box>
  )
}

function Card(ctx: Ctx, e: Entry, i: number, actions: Actions, cardW: number): any {
  const { Box, Text } = ctx.els
  const Button: any = mkButton(ctx)
  const isTerm = ctx.surface === 'terminal'
  const px = Math.max(80, cardW * 8 - 24)
  const rows = Math.max(4, Math.round(cardW * 0.35))
  const thumb = Thumb(ctx, e, { columns: cardW - 2, rows, w: px, h: Math.round(px * 0.75) })
  const badge = `${extOf(e.name) || '—'} · ${sizeOf(e.size)}`
  const open = () => actions.openFile(e.path)
  return (
    <Box
      key={`card-${i}`}
      flexDirection="column"
      width={cardW}
      borderStyle="round"
      borderColor={RULE}
      alignItems="center"
      backgroundColor={PANEL}
      paddingX={1}
      paddingBottom={1}
      hover={{ borderColor: RULE_HI, backgroundColor: PANEL2 }}
    >
      <Box key={`thumb-${i}`} height={isTerm ? rows : undefined} justifyContent="center" alignItems="center">
        {thumb}
        {ThumbHit(ctx, i, e.path)}
      </Box>
      <Button key={`open-${i}`} label={shorten(e.name, cardW - 4)} onPress={open} />
      <Text color={SUB}>
        {badge}
      </Text>
    </Box>
  )
}

export function Grid(
  ctx: Ctx,
  p: { entries: Entry[]; actions: Actions; hint?: string },
): any {
  const { Box, Text } = ctx.els
  if (p.entries.length === 0) {
    return (
      <Box key="empty" flexDirection="column" alignItems="center" paddingY={2} rowGap={1}>
        <Text color={INK}>☕ この棚には、まだメニューがありません</Text>
        <Text color={SUB}>
          上の「画像・音声・動画…」から種類を増やすか、別のフォルダへどうぞ
        </Text>
      </Box>
    )
  }
  const size = ((p.actions as any).cardSize ?? 'm') as 's' | 'm' | 'l'
  const { cardW } = layoutFor(ctx.width, size)
  const dirs = p.entries.map((e, i) => ({ e, i })).filter(x => x.e.isDir)
  const files = p.entries.map((e, i) => ({ e, i })).filter(x => !x.e.isDir)
  return (
    <Box key="grid" flexDirection="column" rowGap={1}>
      {files.length > 0 && (
        <Box key="files" flexDirection="column" rowGap={1}>
          {Section(ctx, 'sec-files', '本日の一品 ─ ファイル', files.length)}
          <Box flexDirection="row" flexWrap="wrap" columnGap={1} rowGap={1}>
            {files.slice(0, MAX_FILES).map(({ e, i }) => Card(ctx, e, i, p.actions, cardW))}
          </Box>
          {files.length > MAX_FILES && (
            <Text key="more" color={SUB}>
              ほか {files.length - MAX_FILES} 件（種類を絞ると見やすくなります）
            </Text>
          )}
        </Box>
      )}
      {dirs.length > 0 && (
        <Box key="dirs" flexDirection="column" rowGap={1}>
          {Section(ctx, 'sec-dirs', '奥の棚 ─ フォルダ', dirs.length)}
          <Box flexDirection="row" flexWrap="wrap" columnGap={1} rowGap={1}>
            {dirs.map(({ e, i }) => FolderTile(ctx, e, i, p.actions))}
          </Box>
        </Box>
      )}
    </Box>
  )
}
