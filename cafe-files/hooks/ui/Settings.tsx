import type { Actions, Ctx, Kind } from '../types'
import { mkButton, BG, PANEL, PANEL2, INK, SUB, ACC, RULE, RULE_HI } from './Btn'
import { KIND_LABEL } from './icons'

export const ALL_KINDS: Kind[] = ['image', 'audio', 'video', 'doc', 'other']

export function toggleKind(kinds: Kind[], k: Kind): Kind[] {
  const has = kinds.includes(k)
  const next = has ? kinds.filter(x => x !== k) : [...kinds, k]
  // 全部外すと何も見えなくなるので最低 1 つは残す
  return next.length === 0 ? kinds : ALL_KINDS.filter(x => next.includes(x))
}

/** 種別チップ（ON は ● / OFF は ○） */
export function KindChips(ctx: Ctx, p: { kinds: Kind[]; actions: Actions }): any {
  const {Box,  } = ctx.els
  const Button: any = mkButton(ctx)
  return (
    <Box key="chips" flexDirection="row" flexWrap="wrap" columnGap={1}>
      {ALL_KINDS.map(k => (
        <Button
          key={`chip-${k}`}
          variant={p.kinds.includes(k) ? 'primary' : 'secondary'}
          label={`${p.kinds.includes(k) ? '●' : '○'} ${KIND_LABEL[k]}`}
          onPress={() => p.actions.setKinds(toggleKind(p.kinds, k))}
        />
      ))}
    </Box>
  )
}

export function Settings(
  ctx: Ctx,
  p: { kinds: Kind[]; showHidden: boolean; actions: Actions },
): any {
  const {Box, Text,  } = ctx.els
  const Button: any = mkButton(ctx)
  // Actions 契約に無い任意の拡張（core が実装していれば有効になる）
  const ext = p.actions as Actions & {
    toggleHidden?: () => void
    toggleSort?: () => void
    cycleSize?: () => void
    toggleBgm?: () => void
    bgm?: boolean
    cardSize?: 's' | 'm' | 'l'
    sort?: 'name' | 'recent'
  }
  return (
    <Box
      key="settings"
      flexDirection="column"
      borderStyle="round"
      borderColor={RULE}
     
      paddingX={1}
      rowGap={1}
    >
      <Text bold color={INK}>
        ☕ メニューの絞り込み（表示するファイルの種類）
      </Text>
      {KindChips(ctx, p)}
      <Box flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
        {ext.toggleHidden ? (
          <Button
            key="set-hidden"
            variant={p.showHidden ? 'primary' : 'secondary'}
            label={`${p.showHidden ? '●' : '○'} 隠しファイル`}
            onPress={() => ext.toggleHidden!()}
          />
        ) : (
          <Text color={SUB}>隠しファイル: {p.showHidden ? '表示' : '非表示'}</Text>
        )}
        {ext.toggleSort ? (
          <Button
            key="set-sort"
            label={`並び順: ${ext.sort === 'recent' ? '新しい順' : '名前順'}`}
            onPress={() => ext.toggleSort!()}
          />
        ) : (
          <Text color={SUB}>並び順: 名前順</Text>
        )}
        {ext.toggleBgm && (
          <Button
            key="set-bgm"
            variant={ext.bgm ? 'primary' : 'secondary'}
            label={ext.bgm ? '♪ BGM: オン' : '♪ BGM: オフ'}
            onPress={() => ext.toggleBgm!()}
          />
        )}
        {ext.cycleSize && (
          <Button
            key="set-size"
            label={`カード: ${ext.cardSize === 's' ? '小（たくさん）' : ext.cardSize === 'l' ? '大（じっくり）' : '中'}`}
            onPress={() => ext.cycleSize!()}
          />
        )}
      </Box>
      <Box key="settings-foot" flexDirection="row" justifyContent="flex-end">
        <Button key="settings-done" variant="primary" label="✓ 完了" onPress={() => p.actions.toggleSettings()} />
      </Box>
    </Box>
  )
}
