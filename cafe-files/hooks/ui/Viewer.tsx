import type { Actions, Ctx, Entry } from '../types'
import { mkButton, BG, PANEL, PANEL2, INK, SUB, ACC, RULE, RULE_HI } from './Btn'
import { KIND_LABEL, glyph, extOf } from './icons'
import { Preview } from './Thumb'

export function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function fmtDate(ms: number): string {
  const d = new Date(ms)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// ---------------------------------------------------------------------------
// 伝票（オーダー票）SVG
// ---------------------------------------------------------------------------

const xml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** 表示幅（半角=1, 全角=2）で数える */
function cw(ch: string): number {
  const c = ch.codePointAt(0) ?? 0
  return c > 0x2e7f ? 2 : 1
}
function width(s: string): number {
  let n = 0
  for (const ch of s) n += cw(ch)
  return n
}
function headCut(s: string, max: number): string {
  if (width(s) <= max) return s
  let out = ''
  let n = 0
  for (const ch of s) {
    if (n + cw(ch) > max - 1) break
    out += ch
    n += cw(ch)
  }
  return out + '…'
}
/** 中間省略（長いパス用）。max は半角換算の幅 */
export function midCut(s: string, max: number): string {
  if (width(s) <= max) return s
  const chars = [...s]
  const keep = Math.max(2, max - 1)
  let head = ''
  let tail = ''
  let hn = 0
  let tn = 0
  const hMax = Math.floor(keep * 0.4)
  for (const ch of chars) {
    if (hn + cw(ch) > hMax) break
    head += ch
    hn += cw(ch)
  }
  for (let i = chars.length - 1; i >= 0; i--) {
    const ch = chars[i]!
    if (tn + cw(ch) > keep - hn) break
    tail = ch + tail
    tn += cw(ch)
  }
  return `${head}…${tail}`
}

/** 上下ギザギザの伝票の外形 */
function slipPath(x0: number, y0: number, w: number, h: number, tooth: number): string {
  const n = Math.max(6, Math.round(w / (tooth * 2)))
  const step = w / n
  let d = `M${x0} ${y0 + tooth}`
  for (let i = 0; i < n; i++) {
    d += ` L${(x0 + step * (i + 0.5)).toFixed(1)} ${y0} L${(x0 + step * (i + 1)).toFixed(1)} ${y0 + tooth}`
  }
  d += ` L${x0 + w} ${y0 + h - tooth}`
  for (let i = n; i > 0; i--) {
    d += ` L${(x0 + step * (i - 0.5)).toFixed(1)} ${y0 + h} L${(x0 + step * (i - 1)).toFixed(1)} ${y0 + h - tooth}`
  }
  return d + ' Z'
}

/**
 * 伝票風の情報カード（SVG 文字列）。width は px（240〜420 に丸める）。
 * opts.index / total があれば伝票番号として「No. 3/12」を載せる。
 */
export function receiptSvg(e: Entry, w: number, opts: { index?: number; total?: number } = {}): string {
  const W = Math.round(Math.max(240, Math.min(420, w || 420)))
  const pad = 22
  const inner = W - pad * 2
  const C = {
    paper: '#FFF8EC',
    edge: '#E2CFB1',
    ink: '#3B2A20',
    sub: '#7A6552',
    acc: '#B9793C',
    stamp: '#B5543A',
  }
  const font = "ui-monospace, 'SF Mono', Menlo, 'Hiragino Sans', monospace"
  const jp = "'Hiragino Maru Gothic ProN', 'Hiragino Sans', ui-rounded, system-ui, sans-serif"
  // 1 文字あたりの幅（px）の目安
  const nameMax = Math.floor(inner / 8.4) // 15px 太字
  const rowMax = Math.floor(inner / 7.4) // 12.5px
  const pathMax = Math.floor(inner / 6.2) // 10.5px

  const kind = e.isDir ? 'フォルダ' : KIND_LABEL[e.kind]
  const ext = e.isDir ? '' : extOf(e.name)
  const rows: [string, string][] = [
    ['種別', ext ? `${kind}（${ext}）` : kind],
    ['サイズ', e.isDir ? '—' : fmtSize(e.size)],
    ['更新日', fmtDate(e.mtimeMs)],
  ]
  const no =
    opts.index !== undefined && opts.total ? `No. ${String(opts.index + 1).padStart(2, '0')}/${opts.total}` : ''

  const tooth = 6
  let y = tooth + 26
  const parts: string[] = []
  const dash = (yy: number) =>
    `<line x1="${pad}" y1="${yy}" x2="${W - pad}" y2="${yy}" stroke="${C.sub}" stroke-width="1" stroke-dasharray="3 4" opacity="0.7"/>`

  // 見出し
  parts.push(
    `<text x="${pad}" y="${y}" font-family="${font}" font-size="11" letter-spacing="2" fill="${C.sub}">CAFE FILES</text>`,
  )
  if (no)
    parts.push(
      `<text x="${W - pad}" y="${y}" text-anchor="end" font-family="${font}" font-size="11" fill="${C.sub}">${xml(no)}</text>`,
    )
  y += 30
  parts.push(
    `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${font}" font-size="24" font-weight="700" letter-spacing="8" fill="${C.ink}">ORDER</text>`,
  )
  // 小さなカップ
  const cx = W / 2
  y += 14
  parts.push(
    `<g transform="translate(${cx - 9} ${y - 2})" fill="none" stroke="${C.acc}" stroke-width="1.6" stroke-linecap="round"><path d="M0 4h14v4a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6z"/><path d="M14 6h2a2.5 2.5 0 0 1 0 5h-2"/></g>`,
  )
  y += 22
  parts.push(dash(y))

  // 品名
  y += 26
  parts.push(
    `<text x="${pad}" y="${y}" font-family="${jp}" font-size="11" fill="${C.sub}">品名</text>`,
  )
  y += 22
  parts.push(
    `<text x="${pad}" y="${y}" font-family="${jp}" font-size="15" font-weight="700" fill="${C.ink}">${xml(headCut(e.name, nameMax))}</text>`,
  )
  y += 14
  parts.push(dash(y))

  // 明細行（ラベル …… 値）
  for (const [k, v] of rows) {
    y += 24
    const val = headCut(v, Math.max(8, rowMax - width(k) - 3))
    const lw = width(k) * 6.6 + 8
    const vw = width(val) * 6.6 + 8
    parts.push(
      `<text x="${pad}" y="${y}" font-family="${jp}" font-size="12.5" fill="${C.sub}">${xml(k)}</text>`,
      `<line x1="${(pad + lw).toFixed(1)}" y1="${y - 4}" x2="${Math.max(pad + lw, W - pad - vw).toFixed(1)}" y2="${y - 4}" stroke="${C.edge}" stroke-width="1.4" stroke-dasharray="1 4" stroke-linecap="round"/>`,
      `<text x="${W - pad}" y="${y}" text-anchor="end" font-family="${jp}" font-size="12.5" fill="${C.ink}">${xml(val)}</text>`,
    )
  }
  y += 16
  parts.push(dash(y))

  // パス
  y += 20
  parts.push(`<text x="${pad}" y="${y}" font-family="${jp}" font-size="10.5" fill="${C.sub}">場所</text>`)
  y += 17
  parts.push(
    `<text x="${pad}" y="${y}" font-family="${font}" font-size="10.5" fill="${C.ink}">${xml(midCut(e.path, pathMax))}</text>`,
  )
  y += 26
  parts.push(
    `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${font}" font-size="10" letter-spacing="3" fill="${C.sub}">THANK YOU ☕</text>`,
  )
  const H = y + 16 + tooth

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<path d="${slipPath(1, 3, W - 2, H - 5, tooth)}" fill="#000" opacity="0.08" transform="translate(0 2)"/>` +
    `<path d="${slipPath(1, 1, W - 2, H - 5, tooth)}" fill="${C.paper}" stroke="${C.edge}" stroke-width="1"/>` +
    parts.join('') +
    `</svg>`
  )
}

/** receiptSvg の高さ（viewBox から） */
function svgHeight(svg: string): number {
  const m = svg.match(/viewBox="0 0 \d+ (\d+(?:\.\d+)?)"/)
  return m ? Number(m[1]) : 300
}

// ---------------------------------------------------------------------------
// 詳細画面
// ---------------------------------------------------------------------------

/** キーボード: 実際の ←/→/Esc は Client が要るため、Button の hotkey（h/l/x/p/c）で代替 */
export function Viewer(
  ctx: Ctx,
  p: { entry: Entry; index: number; total: number; actions: Actions },
): any {
  const { Box, Text, Svg } = ctx.els
  const Button: any = mkButton(ctx)
  const e = p.entry
  const isTerm = ctx.surface === 'terminal'
  const useSvg = !isTerm && !!Svg
  const kindLabel = e.isDir ? 'フォルダ' : KIND_LABEL[e.kind]

  // プレビュー寸法。desktop は両脇の大きな ◀▶ ぶん（約 120px）を引く
  const cols = Math.max(20, Math.min((ctx.width || 60) - 6, 64))
  const pxW = ctx.width ? Math.floor(ctx.width * 7) : 560
  const pw = Math.max(160, Math.min(480, pxW - 150))
  const shown = Preview(ctx, e, { columns: cols, rows: 18, w: pw, h: Math.round((pw * 3) / 4) })

  // 中央: トレイに置いた写真（round 枠 + 余白）。desktop は両脇に大きな ◀ ▶
  const tray = (
    <Box
      key="viewer-body"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      borderStyle="round"
      borderColor={RULE}
      paddingX={isTerm ? 1 : 2}
      paddingY={isTerm ? 0 : 1}
      height={isTerm ? 20 : undefined}
      flexShrink={1}
    >
      {shown}
    </Box>
  )
  const stage = isTerm ? (
    <Box key="viewer-stage" flexDirection="column" rowGap={0}>
      {tray}
      <Box flexDirection="row" columnGap={1} justifyContent="center">
        <Button key="viewer-prev" hotkey="h" label="◀ 前" onPress={() => p.actions.step(-1)} />
        <Button key="viewer-next" hotkey="l" label="次 ▶" onPress={() => p.actions.step(1)} />
      </Box>
    </Box>
  ) : (
    <Box key="viewer-stage" flexDirection="row" alignItems="center" justifyContent="center" columnGap={2}>
      <Button key="viewer-prev" hotkey="h" label="◀" onPress={() => p.actions.step(-1)} />
      {tray}
      <Button key="viewer-next" hotkey="l" label="▶" onPress={() => p.actions.step(1)} />
    </Box>
  )

  // 伝票カード
  let slip: any
  if (useSvg) {
    // 伝票は画像より小さく（画像幅の 75% まで）。SVG は 240px 以上で作り、表示時に縮める
    const sw = Math.round(Math.max(150, Math.min(360, pw * 0.75)))
    const src = receiptSvg(e, Math.max(240, sw), { index: p.index, total: p.total })
    const srcW = Number(/width="(\d+(?:\.\d+)?)"/.exec(src)?.[1] ?? sw)
    slip = (
      <Box key="viewer-slip" flexDirection="row" justifyContent="center">
        <Svg
          source={src}
          alt={`${e.name} ・ ${kindLabel} ・ ${fmtSize(e.size)} ・ ${fmtDate(e.mtimeMs)}`}
          width={sw}
          height={Math.round((svgHeight(src) * sw) / srcW)}
        />
      </Box>
    )
  } else {
    const row = (k: string, v: string) => (
      <Box key={`slip-${k}`} flexDirection="row" columnGap={1}>
        <Text color={SUB}>
          {k.padEnd(4, '　')}
        </Text>
        <Text color={INK}>{v}</Text>
      </Box>
    )
    slip = (
      <Box key="viewer-slip" flexDirection="column" borderStyle="dashed" borderColor={RULE} paddingX={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold color={ACC}>
            {glyph('coffee')} ORDER
          </Text>
          <Text color={SUB}>
            No. {String(p.index + 1).padStart(2, '0')}/{p.total}
          </Text>
        </Box>
        <Text bold color={INK} wrap="truncate-end">
          {e.name}
        </Text>
        <Text color={SUB}>
          {'┄'.repeat(Math.max(8, Math.min(cols - 4, 40)))}
        </Text>
        {row('種別', kindLabel + (extOf(e.name) && !e.isDir ? `（${extOf(e.name)}）` : ''))}
        {row('サイズ', e.isDir ? '—' : fmtSize(e.size))}
        {row('更新日', fmtDate(e.mtimeMs))}
        <Text color={SUB} wrap="truncate-middle">
          {e.path}
        </Text>
      </Box>
    )
  }

  const meta = [kindLabel, e.isDir ? '' : fmtSize(e.size), fmtDate(e.mtimeMs)].filter(Boolean).join(' ・ ')

  // 上部: 1 段目 = 戻る / 位置、2 段目 = ファイル名と情報、3 段目 = アクション（すべて左揃え）
  const header = (
    <Box key="viewer-header" flexDirection="column" rowGap={1}>
      <Box key="viewer-toolbar" flexDirection="row" alignItems="center" justifyContent="space-between">
        <Button key="viewer-close" hotkey="x" label="← 一覧へ" onPress={() => p.actions.closeViewer()} />
        <Box
          key="viewer-pos"
          flexDirection="row"
          borderStyle="round"
          borderColor={RULE}
          backgroundColor={PANEL}
          paddingX={1}
        >
          <Text key="viewer-count" bold color={ACC}>
            {p.index + 1}
          </Text>
          <Text color={SUB}> / {p.total} 品目</Text>
        </Box>
      </Box>
      <Box key="viewer-title" flexDirection="column" alignItems="center">
        <Box flexDirection="row" columnGap={1} justifyContent="center">
          <Text color={ACC}>☕</Text>
          <Text bold color={INK} wrap="truncate-middle">
            {midCut(e.name, Math.max(12, (ctx.width || 40) - 8))}
          </Text>
        </Box>
        <Text color={SUB}>{meta}</Text>
      </Box>
      <Box key="viewer-actions" flexDirection="row" columnGap={1} flexWrap="wrap" justifyContent="center">
        <Button
          key="viewer-insert"
          hotkey="p"
          variant="primary"
          label={`${glyph('coffee')} プロンプトに入れる`}
          onPress={() => p.actions.insertPath(e.path)}
        />
        {(p.actions as any).copyFile && (
          <Button
            key="viewer-copy-file"
            hotkey="f"
            label={e.kind === 'image' ? '🖼 画像をコピー' : '📄 ファイルをコピー'}
            onPress={() => (p.actions as any).copyFile(e.path)}
          />
        )}
        <Button key="viewer-copy" hotkey="c" label={`${glyph('copy')} パスをコピー`} onPress={() => p.actions.copyPath(e.path)} />
      </Box>
    </Box>
  )

  return (
    <Box key="viewer" flexDirection="column" rowGap={1}>
      {header}
      {stage}
      {slip}
    </Box>
  )
}
