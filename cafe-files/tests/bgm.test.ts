import { expect, mock, test } from 'claude-code/testing'

// audio.play の signal はフックへ渡らないので、「鳴っている間は 2 回目を鳴らさない」
// 「オフにしたら止め、オンで鳴らし直す」で確かめる
test('/files loops the jazz once, and the BGM button stops and restarts it', async ($, on) => {
  mock.env(on, { HOME: '/Users/me' })
  on('session.cwd', async () => ({ value: '/Users/me/proj' }))
  on('fs.list', async () => ({ value: [{ name: 'a.png', kind: 'file', size: 10, mtimeMs: 1, isLink: false }] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }) as any)
  on('ui.close', async () => ({ value: undefined }) as any)
  const plays: any[] = []
  on('audio.play', async (_$: any, e: any) => {
    plays.push(e)
    return new Promise<any>(() => {}) // ループ再生中（終わらない）
  })
  const settle = async (n: number) => {
    for (let i = 0; i < 50 && plays.length < n; i++) await new Promise(r => setTimeout(r, 10))
  }
  await $.command.run({ command: 'files' })
  await settle(1)
  expect(plays).toHaveLength(1)
  expect(plays[0]).toMatchObject({ clip: { asset: 'assets/jazz.mp3' }, shouldLoop: true })
  expect(plays[0].gain).toBeLessThan(1)

  await $.command.run({ command: 'files' })
  await settle(2)
  expect(plays).toHaveLength(1) // 鳴っている間は重ねない

  // 設定の BGM ボタンでオフ → オンにすると、止めてから鳴らし直す
  const ui = await $.ui.mount({ plugin: 'cafe-files', surface: 'desktop', component: 'Pane', requestId: 'cafe-files', props: { bodyColumns: 60 } as any })
  await ui.press({ key: 'settings-open' })
  expect((await ui.find({ key: 'set-bgm' }))?.text).toContain('オン')
  await ui.press({ key: 'set-bgm' })
  expect((await ui.find({ key: 'set-bgm' }))?.text).toContain('オフ')
  await ui.press({ key: 'set-bgm' })
  await settle(2)
  expect(plays).toHaveLength(2)
  await ui.unmount()
})

test('BGM off in userConfig plays nothing', { options: { bgm: false } } as any, async ($, on) => {
  mock.env(on, { HOME: '/Users/me' })
  on('session.cwd', async () => ({ value: '/Users/me/proj' }))
  on('fs.list', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }) as any)
  const plays: any[] = []
  on('audio.play', async (_$: any, e: any) => {
    plays.push(e)
    return { value: undefined } as any
  })
  await $.command.run({ command: 'files' })
  await new Promise(r => setTimeout(r, 50))
  expect(plays).toHaveLength(0)
})

test('on macOS the loop runs afplay once', async ($, on) => {
  mock.env(on, { HOME: '/Users/me' })
  on('session.cwd', async () => ({ value: '/Users/me/proj' }))
  on('fs.list', async () => ({ value: [{ name: 'a.png', kind: 'file', size: 10, mtimeMs: 1, isLink: false }] }))
  on('fs.exists', async (_$: any, e: any) => ({ value: String(e.path ?? e).endsWith('afplay') }) as any)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as any)
  const spawned: string[][] = []
  let killed = 0
  on('process.spawn', async function* (_$: any, e: any) {
    spawned.push(e.argv)
    try {
      // 再生中（終わらない）。テストの生成器は yield の所でしか止まれないので、時々出力を出す
      for (;;) {
        await new Promise(r => setTimeout(r, 20))
        yield { stream: 'stdout', text: '.' }
      }
    } finally {
      killed++
    }
    return { code: 0, signal: null } as any
  } as any)
  const wait = async (f: () => boolean) => {
    for (let i = 0; i < 80 && !f(); i++) await new Promise(r => setTimeout(r, 10))
  }
  await $.command.run({ command: 'files' })
  await wait(() => spawned.length > 0)
  expect(spawned[0][0]).toBe('/usr/bin/afplay')
  expect(spawned[0].at(-1)).toMatch(/assets\/jazz\.mp3$/)
  // 2 回目の /files では重ねて起動しない
  await $.command.run({ command: 'files' })
  await new Promise(r => setTimeout(r, 50))
  expect(spawned).toHaveLength(1)
  expect(killed).toBe(0)
})
