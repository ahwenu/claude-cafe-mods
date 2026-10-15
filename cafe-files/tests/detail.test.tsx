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
  await ui.press({ key: 'settings-open' })
  expect(await ui.find({ key: 'chip-audio' })).toBeDefined()
  // 開いている間は普通のボタン「✕ 閉じる」と、パネル下の「✓ 完了」で閉じられる
  await ui.press({ key: 'settings-close' })
  expect(await ui.find({ key: 'chip-audio' })).toBeUndefined()
  await ui.press({ key: 'settings-open' })
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
  // サムネの上に重なる「詳細を見る」（カーソルを乗せると見える）で開く
  await ui.press({ key: 'detail-1' })
  expect(await ui.find({ key: 'viewer-insert' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /b\.png/ })).toBeDefined()
  await ui.unmount()
})

test('presses are answered from the latest drawing by key (no lost clicks after a redraw)', async ($, on) => {
  mock.env(on, { HOME: '/Users/me' })
  on('session.cwd', async () => ({ value: '/Users/me/proj' }))
  on('fs.list', async () => ({ value: [
    { name: 'a.png', kind: 'file', size: 10, mtimeMs: 1, isLink: false },
    { name: 'b.png', kind: 'file', size: 10, mtimeMs: 2, isLink: false },
  ] }))
  let log = ''
  on('fs.write', async (_$: any, e: any) => {
    if (String(e.path).includes('cafe-files-debug')) log = String(e.text)
    return { value: undefined } as any
  })
  const ui = await $.ui.mount({ plugin: 'cafe-files', surface: 'desktop', component: 'Pane', requestId: 'cafe-files', props: { bodyColumns: 60 } as any })
  await ui.press({ key: 'detail-1' })
  expect(await ui.find({ key: 'viewer-insert' })).toBeDefined()
  expect(log).toContain('press detail-1')
  expect(log).not.toContain('no handler')
  expect(log).toMatch(/render \d+ms list entries=2 buttons=[1-9]/)
  await ui.unmount()
})
