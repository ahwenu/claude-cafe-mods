import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import {
  baseName,
  breadcrumbs,
  classify,
  findMatchDirs,
  listDirResult,
  parseKinds,
  quotePath,
  resolveTarget,
  resolveToast,
} from './model'
import type { Resolved, SortKey } from './model'
import { Screen } from './ui/Screen'
import { warmPreview, warmThumbs } from './ui/Thumb'
import { loadPet } from './ui/Barista'
import type { Actions, Ctx, Entry, Kind } from './types'

const PANE = 'cafe-files'
const TITLE = '喫茶ファイル'

const cwdA = atom({ plugin: 'cafe-files', key: 'cwd' } as const, '')
const openA = atom({ plugin: 'cafe-files', key: 'openPath' } as const, '')

// 自動解決の世代。解決中に別の移動が来たら古い結果は捨てる（最後の操作が勝つ）。
let resolveGen = 0

type GoTarget = { kinds: Kind[]; showHidden: boolean }

// ── BGM（喫茶店のジャズ）──────────────────────────────
// assets/jazz.mp3: "jazz improvisation looped" by Alex McCulloch (Pro Sensory), CC0
const BGM_ASSET = 'assets/jazz.mp3'
const BGM_GAIN = 0.3
let bgm: AbortController | null = null

/**
 * ループ再生を始める（既に鳴っていれば何もしない）。
 * macOS では afplay を直接起動してループさせる（デスクトップアプリのセッションでは
 * $.audio.play が再生されずに終わるため）。afplay が無い環境では $.audio.play に任せる。
 */
function startBgm($: any): void {
  if (bgm) return
  const ctl = new AbortController()
  bgm = ctl
  void (async () => {
    const file = `${$.plugin.root}/${BGM_ASSET}`
    const hasAfplay = await $.fs.exists('/usr/bin/afplay').catch(() => false)
    if (!hasAfplay) {
      await $.audio
        .play({ asset: BGM_ASSET }, { shouldLoop: true, gain: BGM_GAIN, signal: ctl.signal })
        .catch((err: any) => $.ui.log(`cafe-files: BGM を再生できませんでした: ${err?.message ?? err}`, { to: 'debug' }))
      return
    }
    let fails = 0
    while (!ctl.signal.aborted && fails < 3) {
      const started = Date.now()
      const child = $.process.spawn({ argv: ['/usr/bin/afplay', '-v', String(BGM_GAIN), file] })
      const kill = () => void child.return?.(undefined)
      ctl.signal.addEventListener('abort', kill, { once: true })
      try {
        for await (const _piece of child) {
          if (ctl.signal.aborted) break
        }
      } catch {
        // 起動できない・止めたときに投げられる。下の fails で打ち切る
      } finally {
        ctl.signal.removeEventListener('abort', kill)
      }
      // すぐ終わる＝再生できていない。3 回続いたら諦める
      fails = Date.now() - started < 3000 ? fails + 1 : 0
    }
  })().finally(() => {
    if (bgm === ctl) bgm = null
  })
}

function stopBgm(): void {
  bgm?.abort()
  bgm = null
}


/**
 * path を「対象ファイルがあるフォルダ」へ解決して cwd に書く。handler / command.run から呼ぶ
 * （render 中は state を書けない）。$ を他所へ渡せない制約のため、トップレベル関数で受ける。
 */
async function goResolved($: any, path: string, t: GoTarget): Promise<void> {
  const my = ++resolveGen
  const io = { list: (p: string) => $.fs.list(p), stat: (p: string) => $.fs.stat(p) }
  let r: Resolved
  try {
    r = await resolveTarget(io, path, { kinds: t.kinds, showHidden: t.showHidden })
  } catch {
    r = { path, reason: 'none' }
  }
  if (my !== resolveGen) return
  await update($, cwdA, () => r.path)
  await update($, openA, () => '')
  const msg = resolveToast(r, t.kinds)
  if (msg) $.ui.toast(msg)
}

export const register: Register = (on, options) => {
  const initKinds = parseKinds(options?.kinds, ['image'])
  const initPet = typeof options?.pet === 'string' && options.pet ? options.pet : 'barista'
  const initHidden = options?.showHidden === true
  const initSort: SortKey = options?.sort === 'recent' ? 'recent' : 'name'

  const settingsA = atom({ plugin: 'cafe-files', key: 'isSettingsOpen' } as const, false)
  const kindsA = atom({ plugin: 'cafe-files', key: 'kinds' } as const, initKinds as string[])
  const hiddenA = atom({ plugin: 'cafe-files', key: 'showHidden' } as const, initHidden)
  const sortA = atom({ plugin: 'cafe-files', key: 'sort' } as const, initSort as string)
  const sizeA = atom({ plugin: 'cafe-files', key: 'cardSize' } as const, 'm')
  const petA = atom({ plugin: 'cafe-files', key: 'pet' } as const, initPet)
  const bgmA = atom({ plugin: 'cafe-files', key: 'bgm' } as const, options?.bgm !== false)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'files',
      description: 'プロジェクトのファイルを喫茶店風ペインで見る',
    })
    // 保存済みの設定があれば状態へ戻す（ユーザー操作 > userConfig 既定）
    try {
      const k = await $.store.get('kinds')
      if (Array.isArray(k)) await update($, kindsA, () => parseKinds(k, initKinds) as string[])
      const h = await $.store.get('showHidden')
      if (typeof h === 'boolean') await update($, hiddenA, () => h)
      const s = await $.store.get('sort')
      if (s === 'name' || s === 'recent') await update($, sortA, () => s)
      const cs = await $.store.get('cardSize')
      if (cs === 's' || cs === 'm' || cs === 'l') await update($, sizeA, () => cs)
      const b = await $.store.get('bgm')
      if (typeof b === 'boolean') await update($, bgmA, () => b)
      const p = await $.store.get('pet')
      if (typeof p === 'string' && p) await update($, petA, () => p)
    } catch {
      /* ストア未対応でも既定で動く */
    }
    return next(e)
  })

  on('command.run', { command: 'files' }, async $ => {
    // 開くときは必ず対象ファイルがあるフォルダへ（未設定なら session cwd から解決）
    const start = (await read($, cwdA)) || (await $.session.cwd())
    await goResolved($, start, {
      kinds: parseKinds(await read($, kindsA), initKinds),
      showHidden: (await read($, hiddenA)) === true,
    })
    await $.ui.open({ id: PANE, title: TITLE })
    // 開いたらジャズを流す（設定でオフにできる）
    if ((await read($, bgmA)) !== false) startBgm($)
    return { text: '喫茶ファイルを開きました。' }
  })

  // ペインを閉じたら（Mod の再読み込み・終了も含む）音楽も止める
  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) stopBgm()
    return next(e)
  })
  on('session.end', async ($, e, next) => {
    stopBgm()
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const io = { list: (p: string) => $.fs.list(p), stat: (p: string) => $.fs.stat(p) }
    const home = (await $.env.get('HOME')) ?? ''
    const cwdState = await read($, cwdA)
    const cwd = cwdState || (await $.session.cwd())
    const openPath = await read($, openA)
    const isSettingsOpen = await read($, settingsA)
    const kinds = parseKinds(await read($, kindsA), initKinds)
    const showHidden = await read($, hiddenA)
    const sort: SortKey = (await read($, sortA)) === 'recent' ? 'recent' : 'name'
    const rawSize = await read($, sizeA)
    const isBgm = (await read($, bgmA)) !== false
    const cardSize = rawSize === 's' || rawSize === 'l' ? rawSize : 'm'
    const pet = await read($, petA)

    const { entries, error: loadError } = await listDirResult(io, cwd, { kinds, showHidden, sort })
    // 黒板メニュー用: 種別フィルタ前の直下件数
    const counts = { image: 0, audio: 0, video: 0, doc: 0, other: 0, dirs: 0 }
    try {
      for (const it of await $.fs.list(cwd)) {
        if (!showHidden && it.name.startsWith('.')) continue
        if (it.kind === 'dir') counts.dirs++
        else if (it.kind !== 'other') counts[classify(it.name)]++
      }
    } catch {
      /* 読めない時は 0 のまま */
    }
    // 直下に表示できるフォルダが無ければ、配下を探査して対象のあるフォルダを探す
    const found =
      !loadError && !entries.some(x => x.isDir)
        ? await findMatchDirs(io, cwd, { kinds, showHidden }).catch(() => [])
        : []
    const files = entries.filter(x => !x.isDir)
    const idx = openPath ? files.findIndex(x => x.path === openPath) : -1
    const openEntry: Entry | undefined = idx >= 0 ? files[idx] : undefined

    const fac = {
      fs: {
        read: (p: string, o?: any) => $.fs.read(p, o),
        exists: (p: string) => $.fs.exists(p),
      },
      process: { run: (a: string[], o?: any) => $.process.run(a, o) },
      plugin: { root: $.plugin.root },
    }
    const surface = (e.surface ?? 'terminal') as Ctx['surface']
    await warmThumbs(fac, entries, surface).catch(() => {})
    if (openEntry) await warmPreview(fac, openEntry, surface).catch(() => {})
    const sprite = pet && pet !== 'none' ? await loadPet(fac, pet).catch(() => null) : null
    const width = Number(e.props?.bodyColumns ?? e.viewport?.columns ?? 40)
    // engine の制約: $ はオブジェクトに入れられない。UI は els / e だけで描く
    const ctx = { e, els, surface, width } as unknown as Ctx

    const actions: Actions & {
      openDirExact: (path: string) => void
      toggleHidden: () => void
      toggleSort: () => void
      sort: SortKey
      cardSize: 's' | 'm' | 'l'
      cycleSize: () => void
      bgm: boolean
      toggleBgm: () => void
    } = {
      bgm: isBgm,
      toggleBgm: () => {
        const v = !isBgm
        void update($, bgmA, () => v)
        void $.store.set('bgm', v).catch(() => {})
        if (v) startBgm($)
        else stopBgm()
      },
      cardSize,
      cycleSize: () => {
        const v = cardSize === 's' ? 'm' : cardSize === 'm' ? 'l' : 's'
        void update($, sizeA, () => v)
        void $.store.set('cardSize', v).catch(() => {})
      },
      sort,
      toggleHidden: () => {
        const v = !showHidden
        void update($, hiddenA, () => v)
        void $.store.set('showHidden', v).catch(() => {})
      },
      toggleSort: () => {
        const v: SortKey = sort === 'recent' ? 'name' : 'recent'
        void update($, sortA, () => v)
        void $.store.set('sort', v).catch(() => {})
      },
      // フォルダタイル・配下で見つかったフォルダ: 対象ファイルがあるフォルダへ自動解決
      openDir: path => {
        void goResolved($, path, { kinds, showHidden })
      },
      // パンくず・上へ・…: 解決せずそのまま（戻れなくなるのを防ぐ）。保留中の解決も打ち消す
      openDirExact: path => {
        resolveGen++
        void update($, cwdA, () => path)
        void update($, openA, () => '')
      },
      openFile: path => {
        void update($, openA, () => path)
      },
      closeViewer: () => {
        void update($, openA, () => '')
      },
      step: delta => {
        const paths = files.map(x => x.path)
        if (paths.length === 0) return
        void update($, openA, cur => {
          const i = paths.indexOf(cur)
          return paths[(i + delta + paths.length) % paths.length]
        })
      },
      toggleSettings: () => {
        void update($, settingsA, v => !v)
      },
      setKinds: (k: Kind[]) => {
        const v = parseKinds(k, ['image'])
        void update($, kindsA, () => v as string[])
        void update($, openA, () => '')
        void $.store.set('kinds', v).catch(() => {})
        // 種別を変えたら現在のフォルダを新しい種別で解決し直す
        void goResolved($, cwd, { kinds: v, showHidden })
      },
      insertPath: path => {
        void (async () => {
          const q = quotePath(path)
          if (q === null) {
            $.ui.toast('このパスは入力欄に入れられません（制御文字を含む）')
            return
          }
          await $.prompt.fill({ text: q + ' ', mode: 'insert' })
          $.ui.toast(`パスを挿入: ${baseName(path)}`)
        })()
      },
      copyPath: path => {
        void (async () => {
          await $.ui.copy({ text: path, surface: e.surface })
          $.ui.toast(`コピー: ${baseName(path)}`)
        })()
      },
    }

    return Screen(ctx, {
      entries,
      crumbs: breadcrumbs(cwd, home),
      cwd,
      openEntry,
      index: Math.max(idx, 0),
      total: files.length,
      kinds,
      showHidden,
      isSettingsOpen,
      actions,
      pet,
      sprite,
      ...(loadError ? { loadError } : {}),
      found,
      counts,
    } as any)
  })
}
