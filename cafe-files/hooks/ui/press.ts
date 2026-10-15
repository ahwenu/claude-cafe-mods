import type { Actions, Crumb, Entry, Kind } from '../types'
import { toggleKind } from './Settings'

/**
 * ui.press の e.element（Button の key）を Actions に割り当てる。
 * Button は onPress を持てない（ツリーは JSON）ため、core は
 *   on('ui.press', {...}, ($, e, next) => handlePress(e.element, {...}) ? ... : next(e))
 * から呼ぶ。描画時と同じ entries / crumbs / kinds を渡すこと。処理したら true。
 */
const exact = (a: any) => (a.openDirExact ?? a.openDir) as (p: string) => void

export function handlePress(
  key: string,
  p: {
    entries: Entry[]
    crumbs: Crumb[]
    kinds: Kind[]
    openEntry?: Entry
    actions: Actions
  },
): boolean {
  const a = p.actions as Actions & { toggleHidden?: () => void; toggleSort?: () => void }
  let m: RegExpMatchArray | null
  if ((m = key.match(/^open-(\d+)$/))) {
    const e = p.entries[Number(m[1])]
    if (!e) return false
    if (e.isDir) a.openDir(e.path)
    else a.openFile(e.path)
    return true
  }
  if ((m = key.match(/^crumb-(\d+)$/))) {
    const c = p.crumbs[Number(m[1])]
    if (!c) return false
    exact(a)(c.path)
    return true
  }
  if ((m = key.match(/^chip-(image|audio|video|doc|other)$/))) {
    a.setKinds(toggleKind(p.kinds, m[1] as Kind))
    return true
  }
  switch (key) {
    case 'crumb-up': {
      const last = p.crumbs[p.crumbs.length - 1]
      const parent =
        p.crumbs[p.crumbs.length - 2]?.path ??
        (last && last.path !== '/' ? last.path.replace(/\/[^/]*$/, '') || '/' : undefined)
      if (!parent) return false
      exact(a)(parent)
      return true
    }
    case 'crumb-more': {
      const hidden = p.crumbs[Math.max(0, p.crumbs.length - 3)]
      if (!hidden) return false
      exact(a)(hidden.path)
      return true
    }
    case 'settings-open':
    case 'settings-close':
      a.toggleSettings()
      return true
    case 'set-hidden':
      a.toggleHidden?.()
      return !!a.toggleHidden
    case 'set-sort':
      a.toggleSort?.()
      return !!a.toggleSort
    case 'viewer-prev':
      a.step(-1)
      return true
    case 'viewer-next':
      a.step(1)
      return true
    case 'viewer-close':
      a.closeViewer()
      return true
    case 'viewer-insert':
      if (!p.openEntry) return false
      a.insertPath(p.openEntry.path)
      return true
    case 'viewer-copy':
      if (!p.openEntry) return false
      a.copyPath(p.openEntry.path)
      return true
  }
  return false
}
