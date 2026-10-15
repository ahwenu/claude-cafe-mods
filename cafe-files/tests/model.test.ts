import { describe, expect, test } from 'claude-code/testing'

import {
  arrange,
  breadcrumbs,
  classify,
  clearMatchCache,
  hasMatch,
  listDirResult,
  quotePath,
  formatDate,
  formatSize,
  findMatchDirs,
  listDir,
  parentOf,
  parseKinds,
  resolveTarget,
  resolveToast,
} from '../hooks/model'
import type { Entry } from '../hooks/types'

const file = (name: string, mtimeMs = 0, size = 10): Entry => ({
  name,
  path: '/p/' + name,
  isDir: false,
  kind: classify(name),
  size,
  mtimeMs,
})
const dir = (name: string): Entry => ({
  name,
  path: '/p/' + name,
  isDir: true,
  kind: 'other',
  size: 0,
  mtimeMs: 0,
})

describe('classify', () => {
  test('extensions map to kinds', () => {
    expect(classify('a.PNG')).toBe('image')
    expect(classify('a.heic')).toBe('image')
    expect(classify('a.flac')).toBe('audio')
    expect(classify('a.mkv')).toBe('video')
    expect(classify('a.docx')).toBe('doc')
    expect(classify('a.numbers')).toBe('doc')
    expect(classify('Makefile')).toBe('other')
    expect(classify('.png')).toBe('other')
    expect(classify('a.tar.gz')).toBe('other')
  })
})

describe('arrange', () => {
  const raw = [file('b.png'), dir('z'), file('a.md'), file('.hid.png'), dir('a2'), file('c.png')]
  test('dirs first, image only, hidden off', () => {
    const out = arrange(raw, { kinds: ['image'], showHidden: false, sort: 'name' })
    expect(out.map(e => e.name)).toEqual(['a2', 'z', 'b.png', 'c.png'])
  })
  test('kinds and hidden', () => {
    const out = arrange(raw, { kinds: ['image', 'doc'], showHidden: true, sort: 'name' })
    expect(out.map(e => e.name)).toEqual(['a2', 'z', '.hid.png', 'a.md', 'b.png', 'c.png'])
  })
  test('recent sort', () => {
    const out = arrange([file('a.png', 1), file('b.png', 9)], {
      kinds: ['image'],
      showHidden: false,
      sort: 'recent',
    })
    expect(out.map(e => e.name)).toEqual(['b.png', 'a.png'])
  })
})

describe('listDir', () => {
  test('uses $.fs.list and stat for links', async () => {
    const $ = {
        list: async () => [
          { name: 'sub', kind: 'dir', size: 0, mtimeMs: 0, isLink: false },
          { name: 'x.jpg', kind: 'file', size: 5, mtimeMs: 7, isLink: false },
          { name: 'n.txt', kind: 'file', size: 5, mtimeMs: 7, isLink: false },
          { name: 'lnk.png', kind: 'other', size: 0, mtimeMs: 0, isLink: true },
        ],
        stat: async () => ({ kind: 'file', size: 3, mtimeMs: 2, isLink: true }),
    }
    const out = await listDir($, '/p', { kinds: ['image'], showHidden: false, sort: 'name' })
    expect(out.map(e => e.path)).toEqual(['/p/sub', '/p/lnk.png', '/p/x.jpg'])
    expect(out[0].isDir).toBe(true)
  })
  test('folders without matching files are hidden (nested match kept)', async () => {
    clearMatchCache()
    const tree: Record<string, any[]> = {
      '/p': [
        { name: 'empty', kind: 'dir' },
        { name: 'docsonly', kind: 'dir' },
        { name: 'deep', kind: 'dir' },
      ],
      '/p/empty': [],
      '/p/docsonly': [{ name: 'a.txt', kind: 'file' }],
      '/p/deep': [{ name: 'in', kind: 'dir' }],
      '/p/deep/in': [{ name: 'pic.png', kind: 'file' }],
    }
    const $ = {
      list: async (p: string) => tree[p] ?? [],
      stat: async () => ({ kind: 'dir', size: 0, mtimeMs: 0 }),
    }
    const out = await listDir($, '/p', { kinds: ['image'], showHidden: false, sort: 'name' })
    expect(out.map(e => e.name)).toEqual(['deep'])
  })
  test('unreadable dir gives []', async () => {
    const $ = {
        list: async () => {
          throw new Error('x')
        },
        stat: async () => ({ kind: 'file', size: 0, mtimeMs: 0 }),
    }
    expect(await listDir($, '/nope', { kinds: ['image'], showHidden: false, sort: 'name' })).toEqual([])
  })
})

describe('hasMatch budget and cache', () => {
  test('budget is per folder and exceeding counts as match', async () => {
    clearMatchCache()
    // 深い空の鎖: 予算 40 を超える前に深さ上限で false になる
    let calls = 0
    const io = {
      list: async (p: string) => {
        calls++
        return Array.from({ length: 5 }, (_, i) => ({ name: 'd' + i, kind: 'dir' }))
      },
      stat: async () => ({ kind: 'dir', size: 0, mtimeMs: 0 }),
    }
    // 5 分岐 × 深さ 4 は 40 回を超える → 「ある」とみなす
    expect(await hasMatch(io, '/a', { kinds: ['image'], showHidden: false })).toBe(true)
    expect(calls).toBe(40)
    // 兄弟は別予算: 2 つ目のフォルダも独立に 40 回まで走査する
    calls = 0
    expect(await hasMatch(io, '/b', { kinds: ['image'], showHidden: false })).toBe(true)
    expect(calls).toBe(40)
  })
  test('30s cache and clearMatchCache', async () => {
    clearMatchCache()
    let calls = 0
    const io = {
      list: async () => {
        calls++
        return [{ name: 'a.png', kind: 'file' }]
      },
      stat: async () => ({ kind: 'file', size: 0, mtimeMs: 0 }),
    }
    const o = { kinds: ['image'] as any, showHidden: false }
    expect(await hasMatch(io, '/c', o)).toBe(true)
    expect(await hasMatch(io, '/c', o)).toBe(true)
    expect(calls).toBe(1)
    clearMatchCache()
    await hasMatch(io, '/c', o)
    expect(calls).toBe(2)
  })
  test('pruneEmpty false skips scan', async () => {
    clearMatchCache()
    const lists: string[] = []
    const io = {
      list: async (p: string) => {
        lists.push(p)
        return p === '/p' ? [{ name: 'empty', kind: 'dir' }] : []
      },
      stat: async () => ({ kind: 'dir', size: 0, mtimeMs: 0 }),
    }
    const out = await listDir(io, '/p', { kinds: ['image'], showHidden: false, sort: 'name', pruneEmpty: false })
    expect(out.map(e => e.name)).toEqual(['empty'])
    expect(lists).toEqual(['/p'])
  })
})

describe('listDirResult', () => {
  test('error is reported, not swallowed', async () => {
    const io = {
      list: async () => {
        throw new Error('EACCES')
      },
      stat: async () => ({ kind: 'file', size: 0, mtimeMs: 0 }),
    }
    const r = await listDirResult(io, '/x', { kinds: ['image'], showHidden: false, sort: 'name' })
    expect(r.entries).toEqual([])
    expect(r.error).toContain('EACCES')
  })
})

describe('quotePath', () => {
  test('plain, spaces, quotes, control chars', () => {
    expect(quotePath('/a/b.png')).toBe('/a/b.png')
    expect(quotePath('/a/my file.png')).toBe('"/a/my file.png"')
    expect(quotePath('/a/q"x.png')).toBe('"/a/q\\"x.png"')
    expect(quotePath('/a/n\nx.png')).toBeNull()
    expect(quotePath('/a/t\tx.png')).toBeNull()
  })
})

describe('findMatchDirs', () => {
  test('finds nearest folders with matching files, skipping node_modules', async () => {
    const tree: Record<string, any[]> = {
      '/p': [{ name: 'a', kind: 'dir' }, { name: 'node_modules', kind: 'dir' }],
      '/p/a': [{ name: 'b', kind: 'dir' }, { name: 'c', kind: 'dir' }],
      '/p/a/b': [{ name: 'x.png', kind: 'file' }, { name: 'deeper', kind: 'dir' }],
      '/p/a/b/deeper': [{ name: 'y.png', kind: 'file' }],
      '/p/a/c': [{ name: 'n.txt', kind: 'file' }],
      '/p/node_modules': [{ name: 'z.png', kind: 'file' }],
    }
    const io = { list: async (d: string) => tree[d] ?? [], stat: async () => ({ kind: 'dir', size: 0, mtimeMs: 0 }) }
    const out = await findMatchDirs(io, '/p', { kinds: ['image'], showHidden: false })
    expect(out).toEqual([{ path: '/p/a/b', rel: 'a/b' }])
  })
})

describe('paths and formats', () => {
  test('breadcrumbs under home', () => {
    expect(breadcrumbs('/Users/a/proj/x', '/Users/a')).toEqual([
      { label: '~', path: '/Users/a', isHome: true },
      { label: 'proj', path: '/Users/a/proj' },
      { label: 'x', path: '/Users/a/proj/x' },
    ])
    expect(breadcrumbs('/Users/a', '/Users/a')).toHaveLength(1)
  })
  test('breadcrumbs outside home', () => {
    expect(breadcrumbs('/opt/x', '/Users/a').map(c => c.label)).toEqual(['/', 'opt', 'x'])
    expect(breadcrumbs('/Users/ab', '/Users/a')[0].isRoot).toBe(true)
  })
  test('parentOf', () => {
    expect(parentOf('/a/b/c')).toBe('/a/b')
    expect(parentOf('/a')).toBe('/')
    expect(parentOf('/')).toBe('/')
  })
  test('formatSize', () => {
    expect(formatSize(0)).toBe('0 B')
    expect(formatSize(1536)).toBe('1.5 KB')
    expect(formatSize(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatSize(300 * 1024 * 1024)).toBe('300 MB')
  })
  test('formatDate', () => {
    expect(formatDate(0)).toBe('')
    expect(formatDate(new Date(2026, 9, 15, 8, 5).getTime())).toBe('2026/10/15 08:05')
  })
  test('parseKinds', () => {
    expect(parseKinds('image, doc')).toEqual(['image', 'doc'])
    expect(parseKinds(['audio', 'bogus'])).toEqual(['audio'])
    expect(parseKinds('')).toEqual(['image'])
  })
})

describe('resolveTarget', () => {
  const mk = (tree: Record<string, any[]>) => {
    const listed: string[] = []
    return {
      listed,
      io: {
        list: async (d: string) => {
          listed.push(d)
          if (!(d in tree)) throw new Error('ENOENT')
          return tree[d]
        },
        stat: async () => ({ kind: 'dir', size: 0, mtimeMs: 0 }),
      },
    }
  }
  const o = { kinds: ['image'] as any, showHidden: false }

  test('self: direct match stays', async () => {
    const { io } = mk({ '/p/x': [{ name: 'a.png', kind: 'file' }, { name: 'sub', kind: 'dir' }] })
    expect(await resolveTarget(io, '/p/x', o)).toEqual({ path: '/p/x', reason: 'self' })
  })
  test('child: nearest folder under dir (same as findMatchDirs head)', async () => {
    const tree = {
      '/p/x': [{ name: 'a', kind: 'dir' }, { name: 'b', kind: 'dir' }],
      '/p/x/a': [{ name: 'deep', kind: 'dir' }],
      '/p/x/a/deep': [{ name: 'q.png', kind: 'file' }],
      '/p/x/b': [{ name: 'r.jpg', kind: 'file' }],
    }
    const { io } = mk(tree)
    const r = await resolveTarget(io, '/p/x', o)
    expect(r).toEqual({ path: '/p/x/b', reason: 'child' })
    expect((await findMatchDirs(io, '/p/x', o))[0].path).toBe(r.path)
  })
  test('child skips SKIP_DIRS and hidden', async () => {
    const { io, listed } = mk({
      '/p/x': [{ name: 'node_modules', kind: 'dir' }, { name: '.git', kind: 'dir' }, { name: '.cache', kind: 'dir' }],
      '/p/x/node_modules': [{ name: 'a.png', kind: 'file' }],
      '/p/x/.git': [{ name: 'a.png', kind: 'file' }],
      '/p/x/.cache': [{ name: 'a.png', kind: 'file' }],
      '/p': [{ name: 'x', kind: 'dir' }],
    })
    expect(await resolveTarget(io, '/p/x', o)).toEqual({ path: '/p/x', reason: 'none' })
    expect(listed).not.toContain('/p/x/node_modules')
    expect(listed).not.toContain('/p/x/.git')
  })
  test('sibling: first by name with a match (direct or nested), excluding self', async () => {
    const { io, listed } = mk({
      '/p': [
        { name: 'z-pics', kind: 'dir' },
        { name: 'x', kind: 'dir' },
        { name: 'b', kind: 'dir' },
        { name: 'a-empty', kind: 'dir' },
        { name: 'Library', kind: 'dir' },
        { name: 'c.png', kind: 'file' },
      ],
      '/p/x': [{ name: 'n.txt', kind: 'file' }],
      '/p/a-empty': [],
      '/p/b': [{ name: 'inner', kind: 'dir' }],
      '/p/b/inner': [{ name: 'k.png', kind: 'file' }],
      '/p/z-pics': [{ name: 'z.png', kind: 'file' }],
      '/p/Library': [{ name: 'l.png', kind: 'file' }],
    })
    expect(await resolveTarget(io, '/p/x', o)).toEqual({ path: '/p/b/inner', reason: 'sibling' })
    expect(listed.filter(d => d === '/p/x')).toHaveLength(1)
    expect(listed).not.toContain('/p/Library')
  })
  test('sibling never picks dir itself even when only it would match', async () => {
    const { io } = mk({
      '/p': [{ name: 'x', kind: 'dir' }, { name: 'y', kind: 'dir' }],
      '/p/x': [{ name: 'n.txt', kind: 'file' }],
      '/p/y': [{ name: 'm.txt', kind: 'file' }],
    })
    const r = await resolveTarget(io, '/p/x', o)
    expect(r).toEqual({ path: '/p/x', reason: 'none' })
    expect(await resolveTarget(io, '/p/x', { kinds: ['doc'] as any, showHidden: false })).toEqual({ path: '/p/x', reason: 'self' })
  })
  test('none: nothing anywhere, root, and unreadable', async () => {
    const { io } = mk({ '/p': [{ name: 'x', kind: 'dir' }], '/p/x': [] })
    expect(await resolveTarget(io, '/p/x', o)).toEqual({ path: '/p/x', reason: 'none' })
    const { io: io2 } = mk({ '/': [] })
    expect(await resolveTarget(io2, '/', o)).toEqual({ path: '/', reason: 'none' })
    const { io: io3 } = mk({})
    expect(await resolveTarget(io3, '/gone/x', o)).toEqual({ path: '/gone/x', reason: 'none' })
  })
  test('scan is bounded', async () => {
    let calls = 0
    const io = {
      list: async () => {
        calls++
        return Array.from({ length: 6 }, (_, i) => ({ name: 'd' + i, kind: 'dir' }))
      },
      stat: async () => ({ kind: 'dir', size: 0, mtimeMs: 0 }),
    }
    expect((await resolveTarget(io, '/p/x', o)).reason).toBe('none')
    expect(calls).toBeLessThanOrEqual(501)
  })
  test('toast text', () => {
    expect(resolveToast({ path: '/a/pics', reason: 'child' }, ['image'])).toBe('☕ pics を開きました（画像があるフォルダ）')
    expect(resolveToast({ path: '/a/b', reason: 'sibling' }, ['image', 'doc'])).toContain('隣の b')
    expect(resolveToast({ path: '/a', reason: 'self' }, ['image'])).toBeNull()
    expect(resolveToast({ path: '/a', reason: 'none' }, ['image'])).toBeNull()
  })
})
