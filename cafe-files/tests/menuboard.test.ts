import { test, expect } from 'claude-code/testing'
import { MenuBoard, menuBoardSvg, xmlEscape, clip, SVG_LIMIT, ZERO_OPACITY, MENU_MAX_W } from '../hooks/ui/MenuBoard'

// 1x1 の実 PNG（terminal の Image は IHDR まで検査する）
const PNG1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
const mkPet = (png: string): any => {
  const mk = (n: number) => Array.from({ length: n }, () => png)
  return {
    id: 'barista', name: 'Barista', w: 72, h: 78,
    frames: { idle: mk(6), wave: mk(4), run: mk(6), done: mk(6) },
    durations: { idle: [280, 110, 110, 140, 140, 320], wave: [140, 140, 140, 140], run: mk(6).map(() => 120), done: mk(6).map(() => 150) },
  }
}
const PET = mkPet(PNG1)
// 実アセット相当（1 フレーム約 4KB）のサイズ感
const BIG = mkPet('iVBORw0KGgo' + 'A'.repeat(4001))
const COUNTS = { image: 12, audio: 0, video: 3, doc: 0, other: 1, dirs: 5 }

test('xmlEscape と clip', () => {
  expect(xmlEscape(`a&b<c>"d"'e'`)).toBe('a&amp;b&lt;c&gt;&quot;d&quot;&apos;e&apos;')
  expect(clip('あいうえおかきくけこさしすせそたちつてと', 18)).toBe('あいうえおかきくけこさしすせそたち…')
  expect(clip('short', 18)).toBe('short')
})

test('menuBoardSvg: タイトル/サブタイトルはエスケープされる', () => {
  const svg = menuBoardSvg({ title: `<x&y>"'`, subtitle: `~/a&b<c>`, counts: COUNTS, sprite: null, width: 560 })
  expect(svg.startsWith('<svg')).toBe(true)
  expect(svg.endsWith('</svg>')).toBe(true)
  expect(svg.includes('&lt;x&amp;y&gt;&quot;&apos;')).toBe(true)
  expect(svg.includes('~/a&amp;b&lt;c&gt;')).toBe(true)
  expect(svg.includes('<x&y>')).toBe(false)
  expect(svg.includes('本日のメニュー')).toBe(true)
})

test('menuBoardSvg: 上限内・幅は 560 まで・sprite は idle 6 フレームのみ', () => {
  const svg = menuBoardSvg({ title: 'cafe-files', subtitle: '~/Documents/mycodes', counts: COUNTS, sprite: BIG, width: 2000 })
  expect(svg.length).toBeLessThanOrEqual(SVG_LIMIT)
  expect(svg.includes(`width="${MENU_MAX_W}"`)).toBe(true)
  expect((svg.match(/<image /g) ?? []).length).toBe(6)
  expect(svg.includes('repeatCount="indefinite"')).toBe(true)
  const huge = menuBoardSvg({ title: 'x'.repeat(5000), subtitle: 'y'.repeat(5000), counts: COUNTS, sprite: BIG, width: 560 })
  expect(huge.length).toBeLessThanOrEqual(SVG_LIMIT)
})

test('menuBoardSvg: 0 件の行は薄く、1 件以上は通常', () => {
  const svg = menuBoardSvg({ title: 't', subtitle: 's', counts: COUNTS, sprite: null, width: 480 })
  const row = (label: string) => svg.match(new RegExp(`<g class="row[^"]*" data-kind="${label}"[^>]*>`))?.[0] ?? ''
  expect(row('音声')).toContain(`opacity="${ZERO_OPACITY}"`)
  expect(row('書類')).toContain(`opacity="${ZERO_OPACITY}"`)
  expect(row('画像')).not.toContain('opacity=')
  expect(row('フォルダ')).not.toContain('opacity=')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: MenuBoard を描画できる`, async ($, on) => {
    on('ui.render', { component: 'Pane', requestId: 'mb-test' }, async ($, e) => {
      const els = $.ui.resolve(e)
      const ctx = { $, e, els, surface: e.surface, width: 60 } as any
      return MenuBoard(ctx, { title: 'cafe-files', subtitle: '~/Documents/mycodes', counts: COUNTS, sprite: PET, width: 480 })
    })
    const ui = await $.ui.mount({
      plugin: 'cafe-files',
      surface,
      component: 'Pane',
      props: { title: 'ファイル', isFocused: true, bodyColumns: 60 } as any,
      requestId: 'mb-test',
    })
    if (surface === 'desktop') {
      expect((await ui.findAll({ type: 'Svg' })).length).toBe(1)
    } else {
      expect((await ui.findAll({ type: 'Svg' })).length).toBe(0)
      expect((await ui.findAll({ type: 'Text' })).length).toBeGreaterThan(3)
    }
    await ui.unmount()
  })
}
