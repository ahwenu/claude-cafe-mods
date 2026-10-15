import type { Ctx } from '../types'
import { palette } from '../theme'

export type Mode = 'idle' | 'run' | 'done'
export type Pet = {
  id: string
  name: string
  w: number
  h: number
  frames: { idle: string[]; wave: string[]; run: string[]; done: string[] }
  durations: { idle: number[]; wave: number[]; run: number[]; done: number[] }
}

export const PETS = ['barista']

const COUNTS: Record<string, number> = { idle: 6, wave: 4, run: 6, done: 6 }

/** pet JSON の構造検証（OK なら null、NG なら理由）。 */
export function validatePet(o: any): string | null {
  if (!o || typeof o.id !== 'string') return 'id'
  if (!(o.w > 0 && o.h > 0)) return 'size'
  for (const k of Object.keys(COUNTS)) {
    const f = o.frames?.[k]
    const d = o.durations?.[k]
    if (!Array.isArray(f) || f.length !== COUNTS[k]) return `frames.${k}`
    if (!Array.isArray(d) || d.length !== COUNTS[k] || d.some((n: any) => !(n > 0))) return `durations.${k}`
    if (f.some((b: any) => typeof b !== 'string' || !b.startsWith('iVBOR'))) return `png.${k}`
  }
  return null
}

/** assets/<id>.json を読む（非同期）。失敗時は null。 */
const PET_CACHE = new WeakMap<object, Map<string, Pet>>()
const SVG_CACHE = new Map<string, string>()

export async function loadPet($: any, id: string): Promise<Pet | null> {
  const owner: object = $?.fs ?? $
  let per = PET_CACHE.get(owner)
  if (!per) PET_CACHE.set(owner, (per = new Map()))
  const hit = per.get(id)
  if (hit) return hit
  try {
    const raw = await $.fs.read(`${$.plugin.root}/assets/${id}.json`)
    const pet = JSON.parse(typeof raw === 'string' ? raw : String(raw))
    if (validatePet(pet) !== null) return null
    per.set(id, pet as Pet)
    return pet as Pet
  } catch {
    return null
  }
}

/** mode ごとの 1 周ぶんの [frameBase64, ms] 列。idle は数周の後に wave を挟む。 */
export function timeline(pet: Pet, mode: Mode): Array<[string, number]> {
  const seq = (k: 'idle' | 'wave' | 'run' | 'done') =>
    pet.frames[k].map((f, i): [string, number] => [f, pet.durations[k][i] ?? 140])
  if (mode === 'run') return seq('run')
  if (mode === 'done') return seq('done')
  return [...seq('idle'), ...seq('idle'), ...seq('idle'), ...seq('wave')]
}

/** terminal 用: tick 番目のフレーム（base64 PNG） */
export function frameAt(pet: Pet, mode: Mode, tick: number): string {
  const tl = timeline(pet, mode)
  return tl[((tick % tl.length) + tl.length) % tl.length][0]
}

/** terminal の低頻度アニメ。session.start 等から $.clock.every で呼ぶ想定。 */
export async function blitStep($: any, requestId: string, pet: Pet, mode: Mode, tick: number) {
  try {
    await $.ui.blit({ requestId, key: 'barista', source: { png: frameAt(pet, mode, tick) } })
  } catch {}
}

export function baristaSvg(pet: Pet, mode: Mode, shadow = '#3B2A20'): string {
  const ck = `${pet.id}|${mode}|${shadow}`
  const cached = SVG_CACHE.get(ck)
  if (cached) return cached
  const svg = buildSvg(pet, mode, shadow)
  SVG_CACHE.set(ck, svg)
  return svg
}

function buildSvg(pet: Pet, mode: Mode, shadow: string): string {
  const tl = timeline(pet, mode)
  const total = tl.reduce((s, [, ms]) => s + ms, 0)
  const W = pet.w
  const H = pet.h + 8
  const defs = tl
    .map(([b64], i) => `<image id="f${i}" width="${pet.w}" height="${pet.h}" href="data:image/png;base64,${b64}" style="image-rendering:pixelated"/>`)
    .join('')
  let t = 0
  const uses = tl
    .map(([, ms], i) => {
      const a = t / total
      const b = (t + ms) / total
      t += ms
      const kt = [0, a, b, 1].filter((v, j, arr) => j === 0 || v > arr[j - 1]).map((v) => v.toFixed(4))
      // display: none → inline (区間) → none
      let values: string
      let keyTimes: string
      if (a === 0) {
        values = 'inline;none'
        keyTimes = `0;${b.toFixed(4)}`
      } else if (b >= 1) {
        values = 'none;inline'
        keyTimes = `0;${a.toFixed(4)}`
      } else {
        values = 'none;inline;none'
        keyTimes = `0;${a.toFixed(4)};${b.toFixed(4)}`
      }
      void kt
      return `<use href="#f${i}" display="none"><animate attributeName="display" calcMode="discrete" values="${values}" keyTimes="${keyTimes}" dur="${total}ms" repeatCount="indefinite"/></use>`
    })
    .join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<defs>${defs}</defs>` +
    `<ellipse cx="${W / 2}" cy="${H - 5}" rx="${W * 0.36}" ry="4" fill="${shadow}" opacity="0.22"/>` +
    uses +
    `</svg>`
  )
}

export type BaristaProps = { pet: string; sprite?: Pet | null; mode?: Mode; tick?: number }

/** 右下に小さく置く。レイアウトを押し広げないよう固定サイズ。 */
export function Barista(ctx: Ctx, p: BaristaProps): any {
  const { els, surface } = ctx
  const { Box, Text } = els
  const c = palette(ctx)
  const pet = p.sprite ?? null
  const mode: Mode = p.mode ?? 'idle'
  const fallback = <Text color="text">(｡•ᴗ•｡)☕</Text>
  let body: any = fallback
  if (pet) {
    if (surface === 'terminal' && els.Image) {
      body = <els.Image key="barista" source={{ png: frameAt(pet, mode, p.tick ?? 0) }} columns={10} rows={5} alt="(｡•ᴗ•｡)☕" />
    } else if (els.Svg) {
      body = (
        <els.Svg
          source={baristaSvg(pet, mode, c.espresso)}
          alt={`${pet.name} ☕`}
          width={72}
          height={pet.h + 8}
          isInteractive={true}
        />
      )
    }
  }
  return (
    <Box flexDirection="row" justifyContent="flex-end">
      {body}
    </Box>
  )
}
