import type { Actions, Crumb, Ctx } from '../types'
import { mkButton, PANEL, INK, SUB, ACC, RULE } from './Btn'

/** 先頭と末尾2つを残して「…」に畳む */
export function collapse(crumbs: Crumb[], max = 4): ({ c: Crumb; i: number } | null)[] {
  const all = crumbs.map((c, i) => ({ c, i }))
  if (crumbs.length <= max) return all
  return [all[0]!, null, ...all.slice(-2)]
}

/** 親フォルダ（ホーム直下・ルート以外なら / 区切りで一つ上） */
export function parentPath(crumbs: Crumb[]): string | undefined {
  const last = crumbs[crumbs.length - 1]
  if (crumbs.length >= 2) return crumbs[crumbs.length - 2]!.path
  if (last && last.path !== '/') return last.path.replace(/\/[^/]*$/, '') || '/'
  return undefined
}

/**
 * パンくず: 木の看板に「📍 現在地」として道順を並べる。
 * 途中の階層は押せるボタン、現在地はキャラメル色の太字、区切りは豆（•）。
 */
export function Breadcrumb(ctx: Ctx, p: { crumbs: Crumb[]; actions: Actions; trailing?: any }): any {
  const { Box, Text } = ctx.els
  const Button: any = mkButton(ctx)
  const go = (path: string) => ((p.actions as any).openDirExact ?? p.actions.openDir)(path)
  const items = collapse(p.crumbs)
  const parent = parentPath(p.crumbs)
  const lastIdx = p.crumbs.length - 1
  const sep = (k: string) => (
    <Text key={k} color={ACC}>
      ›
    </Text>
  )
  return (
    <Box key="crumbs" flexDirection="row" alignItems="center" columnGap={1}>
      <Box
        key="crumb-plate"
        flexGrow={1}
        flexDirection="row"
        flexWrap="wrap"
        alignItems="center"
        columnGap={1}
        borderStyle="round"
        borderColor={RULE}
        backgroundColor={PANEL}
        paddingX={1}
      >
        {parent ? (
          <Button key="crumb-up" hotkey="u" label="↑ 上へ" onPress={() => go(parent)} />
        ) : (
          <Text color={SUB}>↑ 上へ</Text>
        )}
        <Text color={RULE}>│</Text>
        <Text color={ACC}>📍</Text>
        {items.map((it, n) => {
          if (it === null) {
            const hidden = p.crumbs[Math.max(0, p.crumbs.length - 3)]!
            return (
              <Box key={`crumb-gap-${n}`} flexDirection="row" columnGap={1} alignItems="center">
                {sep(`sep-gap-${n}`)}
                <Button key="crumb-more" label="…" onPress={() => go(hidden.path)} />
              </Box>
            )
          }
          const { c, i } = it
          const label = c.isHome ? '🏠 ホーム' : c.label || '/'
          const isCurrent = i === lastIdx
          return (
            <Box key={`crumb-box-${n}`} flexDirection="row" columnGap={1} alignItems="center">
              {n > 0 && sep(`sep-${n}`)}
              {isCurrent ? (
                <Text key="crumb-cur" bold color={INK}>
                  {label}
                </Text>
              ) : (
                <Button key={`crumb-${i}`} label={label} onPress={() => go(c.path)} />
              )}
            </Box>
          )
        })}
        <Box key="crumb-trail" flexGrow={1} flexDirection="row" justifyContent="flex-end">
          {p.trailing}
        </Box>
      </Box>
    </Box>
  )
}
