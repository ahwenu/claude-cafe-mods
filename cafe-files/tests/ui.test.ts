import { layoutFor } from '../hooks/ui/Grid'
import { test, expect } from 'claude-code/testing'
import { Screen } from '../hooks/ui/Screen'
import { handlePress } from '../hooks/ui/press'
import { shorten, textWidth } from '../hooks/ui/Grid'
import type { Entry, Crumb, Actions, Kind } from '../hooks/types'

const mk = (name: string, kind: Kind, isDir = false): Entry => ({
  name,
  path: `/home/u/proj/${name}`,
  isDir,
  kind,
  size: 2048,
  mtimeMs: 1760000000000,
})
const ENTRIES: Entry[] = [
  mk('assets', 'other', true),
  mk('cat.png', 'image'),
  mk('song.mp3', 'audio'),
  mk('README.md', 'doc'),
]
const CRUMBS: Crumb[] = [
  { label: 'ホーム', path: '/home/u', isHome: true },
  { label: 'a', path: '/home/u/a' },
  { label: 'b', path: '/home/u/a/b' },
  { label: 'c', path: '/home/u/a/b/c' },
  { label: 'proj', path: '/home/u/proj' },
]

const PANE = { title: 'ファイル', isFocused: true, bodyColumns: 80 } as any

for (const surface of ['terminal', 'desktop'] as const) {
  for (const mode of ['grid', 'viewer', 'settings', 'empty', 'error'] as const) {
    test(`${surface}: ${mode}`, async ($, on) => {
      const calls: string[] = []
      const actions: Actions = {
        openDir: p => calls.push('openDir:' + p),
        openFile: p => calls.push('openFile:' + p),
        closeViewer: () => calls.push('close'),
        step: d => calls.push('step:' + d),
        toggleSettings: () => calls.push('settings'),
        setKinds: k => calls.push('kinds:' + k.join(',')),
        insertPath: p => calls.push('insert:' + p),
        copyPath: p => calls.push('copy:' + p),
      }
      on('ui.render', { component: 'Pane', requestId: 'ui-test' }, async ($, e) => {
        const els = $.ui.resolve(e)
        const ctx = { $, e, els, surface: e.surface, width: 80 } as any
        return Screen(ctx, {
          entries: mode === 'empty' || mode === 'error' ? [] : ENTRIES,
          crumbs: CRUMBS,
          cwd: '/home/u/proj',
          openEntry: mode === 'viewer' ? ENTRIES[1] : undefined,
          index: 1,
          total: 4,
          kinds: ['image'],
          showHidden: false,
          isSettingsOpen: mode === 'settings',
          actions,
          pet: 'barista',
          loadError: mode === 'error' ? 'EACCES' : undefined,
        })
      })
      const ui = await $.ui.mount({
        plugin: 'cafe-files',
        surface,
        component: 'Pane',
        props: PANE,
        requestId: 'ui-test',
      })
      const ctxp = { entries: ENTRIES, crumbs: CRUMBS, kinds: ['image'] as Kind[], openEntry: ENTRIES[1], actions }
      const keys = [
        ...(await ui.findAll({ type: 'Button' })),
        ...(await ui.findAll({ type: 'Markdown' } as any)),
      ].map((b: any) => b.key)
      if (mode === 'grid') {
        expect(keys).toContain('open-1')
        expect(keys).toContain('crumb-0')
        expect(keys).toContain('crumb-up')
        expect(keys).toContain('settings-open')
        // 深い階層は「…」に畳まれ、中間 crumb は無い
        expect(keys).not.toContain('crumb-2')
        for (const k of ['open-1', 'open-0', 'crumb-1', 'chip-audio', 'settings-open', 'crumb-up'])
          handlePress(k, ctxp)
        expect(calls).toEqual([
          'openFile:/home/u/proj/cat.png',
          'openDir:/home/u/proj/assets',
          'openDir:/home/u/a',
          'kinds:image,audio',
          'settings',
          'openDir:/home/u/a/b/c',
        ])
      } else if (mode === 'viewer') {
        for (const k of ['viewer-insert', 'viewer-copy', 'viewer-next', 'viewer-prev', 'viewer-close'])
          expect(keys).toContain(k)
        for (const k of ['viewer-insert', 'viewer-copy', 'viewer-next', 'viewer-prev', 'viewer-close'])
          handlePress(k, ctxp)
        expect(calls).toEqual([
          'insert:/home/u/proj/cat.png',
          'copy:/home/u/proj/cat.png',
          'step:1',
          'step:-1',
          'close',
        ])
      } else if (mode === 'settings') {
        expect(keys).toContain('chip-doc')
        expect(keys).toContain('settings-close')
        handlePress('chip-doc', ctxp)
        expect(calls).toEqual(['kinds:image,doc'])
      } else if (mode === 'error') {
        expect(await ui.find({ type: 'Text', text: /このフォルダを開けませんでした: EACCES/ })).toBeDefined()
        expect(keys).toContain('crumb-up')
      } else {
        expect(await ui.find({ type: 'Text', text: /まだメニューがありません/ })).toBeDefined()
      }
      await ui.unmount()
    })
  }
}

test('shorten: 全角名は表示幅で省略', async () => {
  const n = 'とても長い日本語のファイル名前です.png'
  const r = shorten(n, 16)
  expect(textWidth(r) <= 16).toBe(true)
  expect(r.endsWith('….png')).toBe(true)
  expect(shorten('a.png', 16)).toBe('a.png')
  expect(textWidth(shorten('🍰🍰🍰🍰🍰🍰🍰🍰🍰🍰', 8)) <= 8).toBe(true)
})

test('layoutFor is responsive to width and size', () => {
  expect(layoutFor(44, 'm').cols).toBe(2)
  expect(layoutFor(90, 'm').cols).toBe(4)
  expect(layoutFor(90, 's').cols).toBeGreaterThan(layoutFor(90, 'l').cols)
  expect(layoutFor(10, 'l').cols).toBe(1)
})
