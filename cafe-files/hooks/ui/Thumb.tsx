import type { Ctx, Entry } from '../types'
import { Icon } from './icons'

const DIR = '/tmp/cafe-files-thumbs'
const IMAGE_EXT = /\.(png|jpe?g|gif|bmp|tiff?|heic|heif|webp)$/i

/** key → terminal: PNG ファイルの絶対パス / それ以外: data URI。null = 作れなかった */
const cache = new Map<string, string>()
/** 生成中の Promise（同じ key の再入は同じ Promise を待つ） */
const inflight = new Map<string, Promise<void>>()
/** 失敗した時刻。一定時間は再試行しない */
const failedAt = new Map<string, number>()
const RETRY_MS = 5000

/** 2 種の 32bit ハッシュを連結して衝突を避ける */
function hash(s: string): string {
  let a = 5381
  let b = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    a = ((a * 33) ^ c) >>> 0
    b = Math.imul(b ^ c, 16777619) >>> 0
  }
  return a.toString(36) + b.toString(36) + s.length.toString(36)
}

function isTerm(surface: string): boolean {
  return surface === 'terminal'
}

function keyOf(e: Entry, surface: string, px: number): string {
  return `${isTerm(surface) ? 't' : 's'}:${px}:${e.path}:${e.mtimeMs}:${e.size}`
}

export function canThumb(e: Entry): boolean {
  return !e.isDir && e.kind === 'image' && IMAGE_EXT.test(e.name)
}

async function build($: any, e: Entry, surface: string, px: number, key: string): Promise<void> {
  try {
    const term = isTerm(surface)
    const out = `${DIR}/${hash(key)}.${term ? 'png' : 'jpg'}`
    if (!(await $.fs.exists(out))) {
      await $.process.run(['mkdir', '-p', '-m', '700', DIR])
      // 途中まで書かれたファイルを正として使わないよう、一時名に書いて原子的に置換する
      const tmp = `${out}.${Math.random().toString(36).slice(2)}.tmp`
      const args = ['sips', '-Z', String(px), '-s', 'format', term ? 'png' : 'jpeg']
      if (!term) args.push('-s', 'formatOptions', '55')
      const r = await $.process.run([...args, e.path, '--out', tmp], { timeoutMs: 15000 })
      if (r.exitCode !== 0) {
        failedAt.set(key, Date.now())
        await $.process.run(['rm', '-f', tmp]).catch(() => {})
        return
      }
      await $.process.run(['mv', '-f', tmp, out])
    }
    if (term) {
      cache.set(key, out)
      return
    }
    const { base64 } = await $.fs.read(out, { as: 'bytes' })
    if (typeof base64 === 'string' && base64.length < 110000) {
      cache.set(key, `data:image/jpeg;base64,${base64}`)
    } else {
      failedAt.set(key, Date.now() + 3600_000) // 大きすぎる: 当面再試行しない
    }
  } catch {
    failedAt.set(key, Date.now())
  }
}

async function make($: any, e: Entry, surface: string, px: number): Promise<void> {
  const key = keyOf(e, surface, px)
  if (cache.has(key)) return
  const pending = inflight.get(key)
  if (pending) return pending
  const failed = failedAt.get(key)
  if (failed !== undefined && Date.now() - failed < RETRY_MS) return
  const job = build($, e, surface, px, key).finally(() => inflight.delete(key))
  inflight.set(key, job)
  return job
}

async function pool(items: (() => Promise<void>)[], n: number): Promise<void> {
  let i = 0
  const run = async () => {
    while (i < items.length) await items[i++]!()
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, run))
}

/** グリッド表示前に await してサムネを用意する（未準備は種別アイコンにフォールバック） */
export async function warmThumbs($: any, entries: Entry[], surface: string): Promise<void> {
  const todo = entries.filter(canThumb).slice(0, 80)
  await pool(
    todo.map(e => () => make($, e, surface, 192)),
    6,
  )
}

/** 詳細表示前に await して大きいプレビューを用意する */
export async function warmPreview($: any, entry: Entry, surface: string): Promise<void> {
  if (!canThumb(entry)) return
  await make($, entry, surface, isTerm(surface) ? 1024 : 480)
}

function svgOf(data: string, w: number, h: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><image href="${data}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/></svg>`
}

type Size = { columns: number; rows: number; w: number; h: number }

function pick(ctx: Ctx, e: Entry, px: number, o: Size): any | undefined {
  const hit = cache.get(keyOf(e, ctx.surface, px))
  if (!hit) return undefined
  const { Image, Svg } = ctx.els
  if (isTerm(ctx.surface)) {
    if (!Image) return undefined
    return <Image source={{ file: hit, format: 'png' }} columns={o.columns} rows={o.rows} alt={e.name} />
  }
  if (!Svg) return undefined
  const source = svgOf(hit, o.w, o.h)
  if (source.length > 131072) return undefined
  return <Svg source={source} alt={e.name} width={o.w} height={o.h} />
}

/** カード用サムネ。未生成・失敗時は種別アイコン */
export function Thumb(ctx: Ctx, e: Entry, o: Size): any {
  const got = canThumb(e) ? pick(ctx, e, 192, o) : undefined
  if (got) return got
  return Icon(ctx, e.isDir ? 'folder' : e.kind, { size: Math.min(o.w, o.h) })
}

/** 詳細用の大きなプレビュー */
export function Preview(ctx: Ctx, e: Entry, o: Size): any {
  const px = isTerm(ctx.surface) ? 1024 : 480
  const got = canThumb(e) ? pick(ctx, e, px, o) : undefined
  if (got) return got
  // 大きいプレビューが無ければサムネで代用
  const small = canThumb(e) ? pick(ctx, e, 192, o) : undefined
  if (small) return small
  return Icon(ctx, e.isDir ? 'folder' : e.kind, { size: Math.min(o.w, o.h, 160) })
}
