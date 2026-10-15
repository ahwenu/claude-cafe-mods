import type { Actions, Crumb, Ctx, Entry, Kind } from '../types'
import { mkButton, BG, PANEL, PANEL2, INK, SUB, ACC, RULE, RULE_HI } from './Btn'
import { MenuBoard } from './MenuBoard'
import { Breadcrumb } from './Breadcrumb'
import { Grid } from './Grid'
import { Settings } from './Settings'
import { glyph } from './icons'
import { Viewer } from './Viewer'

export type ScreenProps = {
  entries: Entry[]
  crumbs: Crumb[]
  cwd: string
  openEntry?: Entry
  index: number
  total: number
  kinds: Kind[]
  showHidden: boolean
  isSettingsOpen: boolean
  actions: Actions
  pet: string
  loadError?: string
  /** 直下にフォルダが無いとき、配下で見つかった対象フォルダ */
  found?: { path: string; rel: string }[]
  /** 現在フォルダ直下の種類別件数（種別フィルタ前） */
  counts?: { image: number; audio: number; video: number; doc: number; other: number; dirs: number }
  sprite?: any
}

const KIND_JA: Record<string, string> = { image: '画像', audio: '音声', video: '動画', doc: '書類', other: 'その他' }
export function kindSummary(kinds: Kind[]): string {
  if (kinds.length >= 5) return 'すべて'
  const names = kinds.map(k => KIND_JA[k] ?? k)
  return names.length === 1 ? `${names[0]}のみ` : names.join('・')
}

/**
 * 枠なしのギア: マテリアルデザインの settings アイコン（Svg）を描き、その上に
 * 透明な Client（./Hit）を重ねて押下を拾う（Button は枠付きで、Svg は押せないため）
 */
const MD_GEAR =
  'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z'
const MD_CLOSE = 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'
export function gearSvg(isOpen: boolean, color = '#EDB273'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26"><path fill="${color}" d="${isOpen ? MD_CLOSE : MD_GEAR}"/></svg>`
}
function GearLink(ctx: Ctx, isOpen: boolean, toggle: () => void): any {
  const { Box, Button, Svg } = ctx.els
  // 開いている間は確実に押せる普通のボタンで「閉じる」
  if (isOpen || !Svg || ctx.surface === 'terminal') {
    return (
      <Button
        key={isOpen ? 'settings-close' : 'settings-open'}
        hotkey="s"
        variant={isOpen ? 'primary' : undefined}
        label={isOpen ? '✕ 閉じる' : '⚙'}
        onPress={toggle}
      />
    )
  }
  // 閉じている間は枠なしのギア。カーソルを乗せると押せるボタンに変わる（hover は画面側だけで切り替わる）
  return (
    <Box key="gear" flexDirection="row" alignItems="center">
      <Svg source={gearSvg(false)} alt="設定" width={26} height={26} />
      <Box position="absolute" top={0} right={0} display="none" hover={{ display: 'flex' }}>
        <Button key="settings-open" hotkey="s" label="⚙ 設定" onPress={toggle} />
      </Box>
    </Box>
  )
}

export function Screen(ctx: Ctx, p: ScreenProps): any {
  const {Box, Text,  } = ctx.els
  const Button: any = mkButton(ctx)
  const home = p.crumbs[0]?.isHome ? '~' : ''
  const subtitle =
    (home ? '~/' : '/') + p.crumbs.slice(1).map(c => c.label).join('/')
  const counts = p.counts ?? {
    image: p.entries.filter(x => x.kind === 'image' && !x.isDir).length,
    audio: 0, video: 0, doc: 0, other: 0,
    dirs: p.entries.filter(x => x.isDir).length,
  }
  // カフェの黒板メニュー（バリスタつき）を一番上に。ファイルはその下に並ぶ
  const board = (
    <Box key="board" flexDirection="row" justifyContent="center">
      {MenuBoard(ctx, {
        title: p.crumbs[p.crumbs.length - 1]?.label || p.cwd,
        subtitle,
        counts,
        sprite: p.pet !== 'none' ? (p.sprite ?? null) : null,
        width: Math.max(300, (ctx.width || 40) * 8 - 16),
      })}
    </Box>
  )
  const footer = null

  if (p.openEntry) {
    return (
      <Box key="screen" flexDirection="column" rowGap={1} paddingX={2} paddingY={1} backgroundColor={BG}>
        {Viewer(ctx, { entry: p.openEntry, index: p.index, total: p.total, actions: p.actions })}
      </Box>
    )
  }

  return (
    <Box key="screen" flexDirection="column" rowGap={1} paddingX={2} paddingY={1} backgroundColor={BG}>
      {board}
      {Breadcrumb(ctx, {
        crumbs: p.crumbs,
        actions: p.actions,
        trailing: GearLink(ctx, p.isSettingsOpen, () => p.actions.toggleSettings()),
      })}
      {p.isSettingsOpen && Settings(ctx, { kinds: p.kinds, showHidden: p.showHidden, actions: p.actions })}
      {!p.loadError && (
        <Box key="summary" flexDirection="row" columnGap={1} flexWrap="wrap">
          <Text color={ACC}>☕</Text>
          <Text color={SUB}>
            {kindSummary(p.kinds)}を表示中 ・ {p.entries.filter(x => !x.isDir).length} ファイル ・{' '}
            {p.entries.filter(x => x.isDir).length} フォルダ
          </Text>
        </Box>
      )}
      {p.loadError ? (
        <Box key="load-error" flexDirection="column" rowGap={1} paddingY={1}>
          <Text color={INK}>このフォルダを開けませんでした: {p.loadError}</Text>
        </Box>
      ) : (
        <Box key="body" flexDirection="column" rowGap={1}>
          {Grid(ctx, { entries: p.entries, actions: p.actions })}
          {p.found && p.found.length > 0 && (
            <Box key="found" flexDirection="column">
              <Text color={ACC} bold>
                配下で見つかったフォルダ ({p.found.length})
              </Text>
              <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
                {p.found.map((f, i) => (
                  <Button key={`found-${i}`} label={`📁 ${f.rel}`} onPress={() => p.actions.openDir(f.path)} />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
