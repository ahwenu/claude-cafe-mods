import { test, expect } from 'claude-code/testing'
import { receiptSvg, midCut } from '../hooks/ui/Viewer'
import type { Entry } from '../hooks/types'

const mk = (over: Partial<Entry> = {}): Entry => ({
  name: 'latte-art.png',
  path: '/Users/me/proj/assets/latte-art.png',
  isDir: false,
  kind: 'image',
  size: 204800,
  mtimeMs: 1760000000000,
  ...over,
})

test('receiptSvg: ファイル名と明細が入る', () => {
  const s = receiptSvg(mk(), 360, { index: 2, total: 12 })
  expect(s.startsWith('<svg')).toBe(true)
  expect(s.endsWith('</svg>')).toBe(true)
  expect(s).toContain('latte-art.png')
  expect(s).toContain('ORDER')
  expect(s).toContain('200.0 KB')
  expect(s).toContain('No. 03/12')
  expect(s.length).toBeLessThan(131072)
})

test('receiptSvg: XML エスケープ', () => {
  const s = receiptSvg(mk({ name: `a<b>&"c'.png`, path: `/tmp/<x>&y/a<b>&"c'.png` }), 400)
  expect(s).toContain('a&lt;b&gt;&amp;&quot;c&#39;.png')
  expect(s).not.toContain('a<b>')
  expect(s).not.toContain('&"')
})

test('receiptSvg: 長いパス・名前でも上限未満、幅は 240〜420 に丸める', () => {
  const long = 'とても長いフォルダ名'.repeat(200)
  const s = receiptSvg(mk({ name: long + '.png', path: `/${long}/${long}.png` }), 9999)
  expect(s.length).toBeLessThan(131072)
  expect(s).toContain('width="420"')
  expect(s).toContain('…')
  expect(receiptSvg(mk(), 10)).toContain('width="240"')
  expect(receiptSvg(mk({ isDir: true, kind: 'other', name: 'assets' }), 300)).toContain('フォルダ')
})

test('midCut: 先頭と末尾を残す', () => {
  expect(midCut('/short', 20)).toBe('/short')
  const c = midCut('/Users/me/a/very/deep/path/file.png', 20)
  expect(c).toContain('…')
  expect(c.endsWith('file.png')).toBe(true)
  expect(c.startsWith('/Users')).toBe(true)
})
