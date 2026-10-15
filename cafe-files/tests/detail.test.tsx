import { expect, mock, test } from 'claude-code/testing'

test('pressing a file opens the detail view', async ($, on) => {
  mock.env(on, { HOME: '/Users/me' })
  on('session.cwd', async () => ({ value: '/Users/me/proj' }))
  on('fs.list', async () => ({ value: [
    { name: 'a.png', kind: 'file', size: 10, mtimeMs: 1, isLink: false },
    { name: 'b.png', kind: 'file', size: 10, mtimeMs: 1, isLink: false },
  ] }))
  for (const surface of ['desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'cafe-files', surface, component: 'Pane', requestId: 'cafe-files', props: { bodyColumns: 48 } as any })
    await ui.press({ key: 'open-0' } as any)
    expect(await ui.find({ key: 'viewer-insert' })).toBeDefined()
    await ui.unmount()
  }
})

test('the gear link toggles the settings panel on desktop', async ($, on) => {
  mock.env(on, { HOME: '/Users/me' })
  on('session.cwd', async () => ({ value: '/Users/me/proj' }))
  on('fs.list', async () => ({ value: [{ name: 'a.png', kind: 'file', size: 10, mtimeMs: 1, isLink: false }] }))
  const ui = await $.ui.mount({ plugin: 'cafe-files', surface: 'desktop', component: 'Pane', requestId: 'cafe-files', props: { bodyColumns: 60 } as any })
  await ui.pointer({ type: 'down', x: 0, y: 0, button: 'left', in: 'settings-open' })
  expect(await ui.find({ key: 'chip-audio' })).toBeDefined()
  // 開いている間は普通のボタン「✕ 閉じる」と、パネル下の「✓ 完了」で閉じられる
  await ui.press({ key: 'settings-close' })
  expect(await ui.find({ key: 'chip-audio' })).toBeUndefined()
  await ui.pointer({ type: 'down', x: 0, y: 0, button: 'left', in: 'settings-open' })
  await ui.press({ key: 'settings-done' })
  expect(await ui.find({ key: 'chip-audio' })).toBeUndefined()
  await ui.unmount()
})

test('the detail view opens at once even while the preview image is still being made', async ($, on) => {
  mock.env(on, { HOME: '/Users/me' })
  on('session.cwd', async () => ({ value: '/Users/me/proj' }))
  on('fs.list', async () => ({ value: [
    { name: 'a.png', kind: 'file', size: 10, mtimeMs: 1, isLink: false },
    { name: 'b.png', kind: 'file', size: 10, mtimeMs: 2, isLink: false },
  ] }))
  on('fs.exists', async () => ({ value: false }) as any)
  on('process.run', async () => new Promise<any>(() => {})) // sips が終わらない
  const ui = await $.ui.mount({ plugin: 'cafe-files', surface: 'desktop', component: 'Pane', requestId: 'cafe-files', props: { bodyColumns: 60 } as any })
  const t0 = Date.now()
  await ui.press({ key: 'open-0' })
  expect(await ui.find({ key: 'viewer-insert' })).toBeDefined()
  expect(Date.now() - t0).toBeLessThan(2000)
  await ui.unmount()
})

test('pressing the thumbnail itself opens the detail view', async ($, on) => {
  mock.env(on, { HOME: '/Users/me' })
  on('session.cwd', async () => ({ value: '/Users/me/proj' }))
  on('fs.list', async () => ({ value: [
    { name: 'a.png', kind: 'file', size: 10, mtimeMs: 1, isLink: false },
    { name: 'b.png', kind: 'file', size: 10, mtimeMs: 2, isLink: false },
  ] }))
  const ui = await $.ui.mount({ plugin: 'cafe-files', surface: 'desktop', component: 'Pane', requestId: 'cafe-files', props: { bodyColumns: 60 } as any })
  expect(await ui.find({ key: 'detail-1' })).toBeUndefined() // カーソル待ちのボタンはもう無い
  await ui.pointer({ type: 'down', x: 1, y: 1, button: 'left', in: 'thumb-hit-1' })
  expect(await ui.find({ key: 'viewer-insert' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /b\.png/ })).toBeDefined()
  await ui.unmount()
})

test('a click that arrives only as "up" also opens the detail view', async ($, on) => {
  mock.env(on, { HOME: '/Users/me' })
  on('session.cwd', async () => ({ value: '/Users/me/proj' }))
  on('fs.list', async () => ({ value: [{ name: 'a.png', kind: 'file', size: 10, mtimeMs: 1, isLink: false }] }))
  const ui = await $.ui.mount({ plugin: 'cafe-files', surface: 'desktop', component: 'Pane', requestId: 'cafe-files', props: { bodyColumns: 60 } as any })
  await new Promise(r => setTimeout(r, 1600)) // 直前の down の影響を切る
  await ui.pointer({ type: 'up', x: 3, y: 10, button: 'left', in: 'thumb-hit-0' })
  expect(await ui.find({ key: 'viewer-insert' })).toBeDefined()
  await ui.unmount()
})
