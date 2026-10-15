import { expect, mock, test } from 'claude-code/testing'

// UI 操作の雛形: ペインを mount して一覧が出ることを確認する。
// fs は engine の下に敷いた hook で差し替える。
test('pane lists folders and images on every surface', async ($, on) => {
  mock.env(on, { HOME: '/Users/me' })
  on('session.cwd', async () => ({ value: '/Users/me/proj' }))
  on('fs.list', async () => ({ value: [
    { name: 'sub', kind: 'dir', size: 0, mtimeMs: 0, isLink: false },
    { name: 'a.png', kind: 'file', size: 10, mtimeMs: 1, isLink: false },
    { name: 'b.txt', kind: 'file', size: 10, mtimeMs: 1, isLink: false },
  ] }))
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'cafe-files',
      surface,
      component: 'Pane',
      requestId: 'cafe-files',
      props: { bodyColumns: 48 } as any,
    })
    expect(await ui.find({ key: 'open-1' })).toBeDefined()
    await ui.unmount()
  }
})
