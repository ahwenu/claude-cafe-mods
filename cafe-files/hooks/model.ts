import type { Crumb, Entry, Kind } from './types'

export type SortKey = 'name' | 'recent'

const EXT: Record<Exclude<Kind, 'other'>, string[]> = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'svg', 'bmp'],
  audio: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'aiff'],
  video: ['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv'],
  doc: [
    'pdf', 'md', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'key', 'pages', 'numbers', 'csv', 'json',
  ],
}

const BY_EXT = new Map<string, Kind>()
for (const kind of Object.keys(EXT) as Array<keyof typeof EXT>) {
  for (const ext of EXT[kind]) BY_EXT.set(ext, kind)
}

export const ALL_KINDS: Kind[] = ['image', 'audio', 'video', 'doc', 'other']

export function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i <= 0 ? '' : name.slice(i + 1).toLowerCase()
}

export function classify(name: string): Kind {
  return BY_EXT.get(extOf(name)) ?? 'other'
}

export function parseKinds(value: unknown, fallback: Kind[] = ['image']): Kind[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\s]+/)
      : []
  const out = raw.filter((k): k is Kind => ALL_KINDS.includes(k as Kind))
  return out.length > 0 ? Array.from(new Set(out)) : fallback
}

export function joinPath(dir: string, name: string): string {
  return dir === '/' ? '/' + name : dir.replace(/\/+$/, '') + '/' + name
}

export function parentOf(path: string): string {
  const p = path.replace(/\/+$/, '')
  const i = p.lastIndexOf('/')
  return i <= 0 ? '/' : p.slice(0, i)
}

export function baseName(path: string): string {
  const p = path.replace(/\/+$/, '')
  return p.slice(p.lastIndexOf('/') + 1)
}

export function sortEntries(entries: Entry[], sort: SortKey): Entry[] {
  const byName = (a: Entry, b: Entry) =>
    a.name.localeCompare(b.name, 'ja', { numeric: true, sensitivity: 'base' })
  const cmp =
    sort === 'recent'
      ? (a: Entry, b: Entry) => b.mtimeMs - a.mtimeMs || byName(a, b)
      : byName
  const dirs = entries.filter(e => e.isDir).sort(cmp)
  const files = entries.filter(e => !e.isDir).sort(cmp)
  return [...dirs, ...files]
}

/** 純関数: 生の一覧からフォルダ先頭・種別絞込・並べ替えを行う。 */
export function arrange(
  raw: Entry[],
  opts: { kinds: Kind[]; showHidden: boolean; sort: SortKey },
): Entry[] {
  const shown = raw.filter(e => {
    if (!opts.showHidden && e.name.startsWith('.')) return false
    return e.isDir || opts.kinds.includes(e.kind)
  })
  return sortEntries(shown, opts.sort)
}

/** `$` は import をまたいで渡せない(engine の制約)ため、fs は関数で注入する。 */
export type FsIo = {
  list: (path: string) => Promise<any[]>
  stat: (path: string) => Promise<{ kind: string; size: number; mtimeMs: number }>
}

type ListOpts = { kinds: Kind[]; showHidden: boolean; sort: SortKey; pruneEmpty?: boolean }

export async function listDirResult(
  io: FsIo,
  dir: string,
  opts: ListOpts,
): Promise<{ entries: Entry[]; error?: string }> {
  let list: Array<{ name: string; kind: string; size: number; mtimeMs: number; isLink: boolean }>
  try {
    list = await io.list(dir)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { entries: [], error: msg || '読み込めませんでした' }
  }
  const raw: Entry[] = []
  for (const it of list) {
    if (!opts.showHidden && it.name.startsWith('.')) continue
    const path = joinPath(dir, it.name)
    let kind = it.kind
    let size = it.size
    let mtimeMs = it.mtimeMs
    // リンクは先を調べる。フォルダは並べ替え(recent)のときだけ更新時刻を取る。
    if (it.kind === 'other' || (it.kind === 'dir' && opts.sort === 'recent')) {
      try {
        const st = await io.stat(path)
        kind = st.kind
        size = st.size
        mtimeMs = st.mtimeMs
      } catch {
        if (it.kind === 'other') continue
      }
    }
    if (kind === 'other') continue
    const isDir = kind === 'dir'
    raw.push({
      name: it.name,
      path,
      isDir,
      kind: isDir ? 'other' : classify(it.name),
      size: isDir ? 0 : size,
      mtimeMs,
    })
  }
  const shown = arrange(raw, opts)
  if (opts.pruneEmpty === false) return { entries: shown }
  // 表示対象のファイルを含まないフォルダは出さない（フォルダごとに独立した予算）
  const keep = await Promise.all(
    shown.map(e => (e.isDir ? hasMatch(io, e.path, opts) : true)),
  )
  return { entries: shown.filter((_, i) => keep[i]) }
}

export async function listDir(io: FsIo, dir: string, opts: ListOpts): Promise<Entry[]> {
  return (await listDirResult(io, dir, opts)).entries
}

const SCAN_DEPTH = 4
const SCAN_BUDGET = 40
const CACHE_MS = 30_000
const SKIP_DIRS = new Set(['node_modules', '.git', '.build', 'build', 'DerivedData', 'Pods', 'Library'])
const matchCache = new Map<string, { at: number; v: boolean }>()

export function clearMatchCache(): void {
  matchCache.clear()
}

/**
 * dir 配下（SCAN_DEPTH 階層まで）に表示対象のファイルがあるか。
 * フォルダごとに独立の走査予算（SCAN_BUDGET 回）。超えたら「ある」とみなす。30 秒キャッシュ。
 */
export async function hasMatch(
  io: FsIo,
  dir: string,
  opts: { kinds: Kind[]; showHidden: boolean },
): Promise<boolean> {
  const key = `${dir}|${[...opts.kinds].sort().join(',')}|${opts.showHidden}`
  const hit = matchCache.get(key)
  const now = Date.now()
  if (hit && now - hit.at < CACHE_MS) return hit.v
  const v = await scan(io, dir, opts, SCAN_DEPTH, { left: SCAN_BUDGET })
  matchCache.set(key, { at: now, v })
  return v
}

async function scan(
  io: FsIo,
  dir: string,
  opts: { kinds: Kind[]; showHidden: boolean },
  depth: number,
  budget: { left: number },
): Promise<boolean> {
  if (budget.left <= 0) return true
  budget.left -= 1
  let list: Array<{ name: string; kind: string }>
  try {
    list = await io.list(dir)
  } catch {
    return false
  }
  const visible = list.filter(it => opts.showHidden || !it.name.startsWith('.'))
  if (visible.some(it => it.kind !== 'dir' && it.kind !== 'other' && opts.kinds.includes(classify(it.name)))) {
    return true
  }
  if (depth <= 1) return false
  for (const it of visible) {
    if (it.kind !== 'dir' || SKIP_DIRS.has(it.name)) continue
    if (await scan(io, joinPath(dir, it.name), opts, depth - 1, budget)) return true
  }
  return false
}

/** 入力欄へ入れるパスの整形。制御文字を含むなら null（拒否）。空白・引用符を含むなら "..." で囲む。 */
export function quotePath(path: string): string | null {
  if (/[\u0000-\u001f\u007f]/.test(path)) return null
  if (/[\s"']/.test(path)) return '"' + path.replace(/"/g, '\\"') + '"'
  return path
}

/**
 * ホーム配下は「~」起点、それ以外は「/」起点。
 * 例: /Users/a/proj/x, home=/Users/a → [~, proj, x]
 */
export function breadcrumbs(path: string, home: string): Crumb[] {
  const h = home.replace(/\/+$/, '')
  const p = path.replace(/\/+$/, '') || '/'
  const out: Crumb[] = []
  let rest: string[]
  if (h && (p === h || p.startsWith(h + '/'))) {
    out.push({ label: '~', path: h, isHome: true })
    rest = p.slice(h.length).split('/').filter(Boolean)
    let cur = h
    for (const seg of rest) {
      cur = joinPath(cur, seg)
      out.push({ label: seg, path: cur })
    }
  } else {
    out.push({ label: '/', path: '/', isRoot: true })
    let cur = '/'
    for (const seg of p.split('/').filter(Boolean)) {
      cur = joinPath(cur, seg)
      out.push({ label: seg, path: cur })
    }
  }
  return out
}

export function formatSize(bytes: number): string {
  if (!(bytes >= 0)) return ''
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

const pad = (n: number) => String(n).padStart(2, '0')

/** 'YYYY/MM/DD HH:mm'（ローカル時刻）。 */
export function formatDate(ms: number): string {
  if (!ms) return ''
  const d = new Date(ms)
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export type FoundDir = { path: string; rel: string }

/**
 * dir 配下を幅優先で探査し、表示対象のファイルを直接含むフォルダ（最寄りのもの）を返す。
 * 見つかったフォルダの中へは降りない。上限: 深さ maxDepth・走査 maxDirs 回・結果 limit 件。
 */
export async function findMatchDirs(
  io: FsIo,
  dir: string,
  opts: { kinds: Kind[]; showHidden: boolean },
  lim: { maxDepth?: number; maxDirs?: number; limit?: number } = {},
): Promise<FoundDir[]> {
  const maxDepth = lim.maxDepth ?? 8
  let left = lim.maxDirs ?? 500
  const limit = lim.limit ?? 24
  const out: FoundDir[] = []
  let level: string[] = [dir]
  for (let depth = 0; depth < maxDepth && level.length > 0 && left > 0; depth++) {
    const next: string[] = []
    for (const d of level) {
      if (left <= 0 || out.length >= limit) break
      left -= 1
      let list: Array<{ name: string; kind: string }>
      try {
        list = await io.list(d)
      } catch {
        continue
      }
      const visible = list.filter(it => opts.showHidden || !it.name.startsWith('.'))
      const has = visible.some(
        it => it.kind !== 'dir' && it.kind !== 'other' && opts.kinds.includes(classify(it.name)),
      )
      if (has && d !== dir) {
        out.push({ path: d, rel: d.slice(dir.replace(/\/+$/, '').length + 1) })
        continue
      }
      for (const it of visible) {
        if (it.kind === 'dir' && !SKIP_DIRS.has(it.name)) next.push(joinPath(d, it.name))
      }
    }
    level = next
  }
  return out
}

export type ResolveReason = 'self' | 'child' | 'sibling' | 'none'
export type Resolved = { path: string; reason: ResolveReason }

/** 自動解決の走査上限（list 回数）。配下探索・同階層探索それぞれの合計。 */
const RESOLVE_CHILD_BUDGET = 300
const RESOLVE_SIBLING_BUDGET = 200
const RESOLVE_DEPTH = 8

type MatchOpts = { kinds: Kind[]; showHidden: boolean }

function isMatchFile(it: { name: string; kind: string }, opts: MatchOpts): boolean {
  return it.kind !== 'dir' && it.kind !== 'other' && opts.kinds.includes(classify(it.name))
}

/**
 * root 自身を含めて幅優先で探し、対象ファイルを直接含む最初のフォルダを返す。
 * root 以外の順序は findMatchDirs と同じ（findMatchDirs(...)[0] と一致）。予算は呼び出し側と共有。
 */
async function firstMatchDir(
  io: FsIo,
  root: string,
  opts: MatchOpts,
  budget: { left: number },
): Promise<string | null> {
  let level: string[] = [root]
  for (let depth = 0; depth < RESOLVE_DEPTH && level.length > 0; depth++) {
    const next: string[] = []
    for (const d of level) {
      if (budget.left <= 0) return null
      budget.left -= 1
      let list: Array<{ name: string; kind: string }>
      try {
        list = await io.list(d)
      } catch {
        continue
      }
      const visible = list.filter(it => opts.showHidden || !it.name.startsWith('.'))
      if (visible.some(it => isMatchFile(it, opts))) return d
      for (const it of visible) {
        if (it.kind === 'dir' && !SKIP_DIRS.has(it.name)) next.push(joinPath(d, it.name))
      }
    }
    level = next
  }
  return null
}

/**
 * 「必ず対象ファイルがあるフォルダを開く」ための解決。
 * (1) dir 直下にあれば dir（self） (2) 配下の最寄り（child）
 * (3) 同階層のフォルダ（名前順・dir 自身を除く）の中で同じ規則（sibling） (4) dir のまま（none）
 */
export async function resolveTarget(io: FsIo, dir: string, opts: MatchOpts): Promise<Resolved> {
  const own = await firstMatchDir(io, dir, opts, { left: RESOLVE_CHILD_BUDGET })
  if (own) return { path: own, reason: own === dir ? 'self' : 'child' }

  const self = dir.replace(/\/+$/, '') || '/'
  const parent = parentOf(self)
  if (parent === self) return { path: dir, reason: 'none' }
  let list: Array<{ name: string; kind: string }>
  try {
    list = await io.list(parent)
  } catch {
    return { path: dir, reason: 'none' }
  }
  const me = baseName(self)
  const sibs = list
    .filter(
      it =>
        it.kind === 'dir' &&
        it.name !== me &&
        !SKIP_DIRS.has(it.name) &&
        (opts.showHidden || !it.name.startsWith('.')),
    )
    .map(it => it.name)
    .sort((a, b) => a.localeCompare(b, 'ja', { numeric: true, sensitivity: 'base' }))
  const budget = { left: RESOLVE_SIBLING_BUDGET }
  for (const name of sibs) {
    if (budget.left <= 0) break
    const hit = await firstMatchDir(io, joinPath(parent, name), opts, budget)
    if (hit) return { path: hit, reason: 'sibling' }
  }
  return { path: dir, reason: 'none' }
}

const KIND_LABEL: Record<Kind, string> = {
  image: '画像',
  audio: '音声',
  video: '動画',
  doc: '書類',
  other: 'ファイル',
}

/** 解決で別フォルダへ移ったときの通知文。移っていなければ null。 */
export function resolveToast(r: Resolved, kinds: Kind[]): string | null {
  if (r.reason !== 'child' && r.reason !== 'sibling') return null
  const what = kinds.length > 0 && kinds.length < 3 ? kinds.map(k => KIND_LABEL[k]).join('・') : '対象ファイル'
  const where = r.reason === 'sibling' ? '隣の ' : ''
  return `☕ ${where}${baseName(r.path)} を開きました（${what}があるフォルダ）`
}
